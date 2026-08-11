// VOX reader (pure JS, browser/Node通用的).
//
// Returns an enriched structure:
//   { version, models, palette, scene, materials }
//
// - `models`:  Array<{ size:[sx,sy,sz], voxels:[{x,y,z,i}] }>  (向后兼容, 始终存在)
// - `palette`: Array<[r,g,b,a]> | null  (256 项, a=0 透明; 无 RGBA 块时为 null)
// - `scene`:   Array<{ modelIndex, translation:[x,y,z], rotation, hidden, name }>
//             每个实例把 models[modelIndex] 摆到世界坐标. 无场景图的老文件会自动生成
//             (每个模型一个 identity 实例), 因此 scene 始终可用于渲染.
// - `materials`: { [id:number]: { type, metalness, roughness, alpha, emissive } }
//             来自 MATL 块; 索引即调色板颜色索引. 无 MATL 时为 {}.
//
// 解析范围: MAIN / PACK / SIZE / XYZI / RGBA / nTRN / nGRP / nSHP / MATL.
// 场景图(变换/旋转/分组)与材质都会被保留, 写回时(见 writer.js)可无损往返.

function ascii4(u8, off) {
  let s = '';
  for (let i = 0; i < 4; i++) s += String.fromCharCode(u8[off + i]);
  return s;
}

// 读取 DICT: int32 numItems; 每项 int32 keyLen + key(str) + int32 valLen + val(str)
function readDict(dv, u8, off, end) {
  let p = off;
  const num = dv.getUint32(p, true); p += 4;
  const dict = {};
  for (let i = 0; i < num; i++) {
    if (p + 8 > end) break;
    const klen = dv.getUint32(p, true); p += 4;
    let key = '';
    for (let j = 0; j < klen; j++) key += String.fromCharCode(u8[p + j]);
    p += klen;
    const vlen = dv.getUint32(p, true); p += 4;
    let val = '';
    for (let j = 0; j < vlen; j++) val += String.fromCharCode(u8[p + j]);
    p += vlen;
    dict[key] = val;
  }
  return { dict, next: p };
}

// "1 2 3" / "-1 0 3" -> [1,2,3]
function readVec3(str) {
  if (!str) return [0, 0, 0];
  const parts = str.trim().split(/\s+/).map(Number);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

// 24 个保向符号置换旋转矩阵 (标准集合, 与 MagicaVoxel 用同一组矩阵, 仅索引顺序约定不同).
// 用于把 nTRN 的 _r 索引换算成 3x3 矩阵做显示合成; 写回时我们保留原始整数索引,
// 因此无论本表顺序如何, 真实 .vox 文件的往返都无损且能被 MagicaVoxel 正确解释.
export const ROTATION_MATRICES = (() => {
  const axes = [
    [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
  ];
  const out = [];
  const seen = new Set();
  for (const x of axes) {
    for (const y of axes) {
      if (x[0] * y[0] + x[1] * y[1] + x[2] * y[2] !== 0) continue; // 必须正交
      const z = [
        x[1] * y[2] - x[2] * y[1],
        x[2] * y[0] - x[0] * y[2],
        x[0] * y[1] - x[1] * y[0],
      ];
      const m = [x[0], x[1], x[2], y[0], y[1], y[2], z[0], z[1], z[2]];
      const k = m.join(',');
      if (!seen.has(k)) { seen.add(k); out.push(m); }
    }
  }
  return out;
})();

function matMul3(a, b) {
  const r = new Array(9);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let s = 0;
      for (let k = 0; k < 3; k++) s += a[i * 3 + k] * b[k * 3 + j];
      r[i * 3 + j] = s;
    }
  }
  return r;
}

function matVec3(m, v) {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

// 找到与给定 3x3 矩阵最接近的 ROTATION_MATRICES 索引 (精确整数匹配)
function rotationIndex(m) {
  const target = m.map((n) => Math.round(n)).join(',');
  for (let i = 0; i < ROTATION_MATRICES.length; i++) {
    if (ROTATION_MATRICES[i].join(',') === target) return i;
  }
  return 0;
}

// 解析 MATL 字典 -> 高层材质对象.
// 关键约定: 只回写 **chunk 中实际出现的字段**, 不替补默认 0/1.
// 这样 writer 写入哪些键, reader 就得到哪些键, 多模型材质才能无损往返.
// (makeMaterial 在渲染侧对缺失字段做了防御性默认, 见 viewer/mesh.js)
function parseMaterial(dict) {
  const mat = { type: dict._type || dict.type || '_diffuse' };
  const num = (v) => (v === undefined ? undefined : parseFloat(v));
  const metalness = num(dict._metal);
  const roughness = num(dict._rough);
  const alpha = dict._alpha !== undefined ? parseFloat(dict._alpha) : undefined;
  const emissive = num(dict._emit);
  const ior = num(dict._ior);
  const flux = num(dict._flux);
  const density = num(dict._d);
  const specular = num(dict._sp);
  const glow = num(dict._g);
  if (metalness !== undefined) mat.metalness = metalness;     // 0..1
  if (roughness !== undefined) mat.roughness = roughness;     // 0..1
  if (alpha !== undefined) mat.alpha = alpha;                 // 0..1 (1=不透明)
  if (emissive !== undefined) mat.emissive = emissive;        // 0..1 自发光强度
  if (ior !== undefined) mat.ior = ior;
  if (flux !== undefined) mat.flux = flux;
  if (density !== undefined) mat.density = density;
  if (specular !== undefined) mat.specular = specular;
  if (glow !== undefined) mat.glow = glow;
  return mat;
}

export function parseVox(input) {
  const u8 = input instanceof Uint8Array ? input : new Uint8Array(input);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (ascii4(u8, 0) !== 'VOX ') throw new Error('不是合法的 VOX 文件 (magic 不匹配)');
  const version = dv.getUint32(4, true);

  const models = [];
  let palette = null;
  const nodes = {};          // id -> {type, ...}
  const materials = {};       // id -> material props
  let declaredModels = 0;

  function parseChildren(start, end) {
    let p = start;
    while (p + 12 <= end) {
      const id = ascii4(u8, p);
      const N = dv.getUint32(p + 4, true);
      const M = dv.getUint32(p + 8, true);
      const contentStart = p + 12;
      const contentEnd = contentStart + N;
      const childStart = contentEnd;
      const childEnd = childStart + M;

      if (id === 'MAIN') {
        parseChildren(childStart, childEnd);
      } else if (id === 'PACK') {
        declaredModels = dv.getUint32(contentStart, true);
      } else if (id === 'SIZE') {
        const sx = dv.getUint32(contentStart, true);
        const sy = dv.getUint32(contentStart + 4, true);
        const sz = dv.getUint32(contentStart + 8, true);
        models.push({ size: [sx, sy, sz], voxels: [] });
      } else if (id === 'XYZI') {
        const n = dv.getUint32(contentStart, true);
        const vox = [];
        let off = contentStart + 4;
        for (let k = 0; k < n; k++) {
          vox.push({ x: u8[off], y: u8[off + 1], z: u8[off + 2], i: u8[off + 3] });
          off += 4;
        }
        if (models.length) models[models.length - 1].voxels = vox;
      } else if (id === 'RGBA') {
        const raw = [];
        for (let k = 0; k < 256; k++) {
          const o = contentStart + k * 4;
          raw.push([u8[o], u8[o + 1], u8[o + 2], u8[o + 3]]);
        }
        // 还原逻辑调色板: 索引 1..255 = stream[0..254]; 索引 0 = stream[255]
        const logical = Array.from({ length: 256 }, () => [0, 0, 0, 0]);
        for (let i = 0; i < 255; i++) logical[i + 1] = raw[i];
        logical[0] = raw[255];
        palette = logical;
      } else if (id === 'MATL') {
        const mid = dv.getUint32(contentStart, true);
        const { dict } = readDict(dv, u8, contentStart + 4, contentEnd);
        materials[mid] = parseMaterial(dict);
      } else if (id === 'nTRN') {
        const nodeId = dv.getUint32(contentStart, true);
        const a = readDict(dv, u8, contentStart + 4, contentEnd);
        let q = a.next;
        const childNodeId = dv.getUint32(q, true); q += 4;
        q += 4; // reserved (deprecated, 恒 0)
        const t = readDict(dv, u8, q, contentEnd);
        const td = t.dict;
        nodes[nodeId] = {
          type: 'transform',
          child: childNodeId,
          name: a.dict._name || '',
          hidden: a.dict._hidden === '1',
          translation: readVec3(td._t),
          rotation: td._r !== undefined ? (parseInt(td._r, 10) || 0) : 0,
        };
      } else if (id === 'nGRP') {
        const nodeId = dv.getUint32(contentStart, true);
        const a = readDict(dv, u8, contentStart + 4, contentEnd);
        let q = a.next;
        const n = dv.getUint32(q, true); q += 4;
        const children = [];
        for (let i = 0; i < n; i++) { children.push(dv.getUint32(q, true)); q += 4; }
        nodes[nodeId] = { type: 'group', children, name: a.dict._name || '' };
      } else if (id === 'nSHP') {
        const nodeId = dv.getUint32(contentStart, true);
        const a = readDict(dv, u8, contentStart + 4, contentEnd);
        let q = a.next;
        const modelId = dv.getUint32(q, true); q += 4;
        const t = readDict(dv, u8, q, contentEnd);
        nodes[nodeId] = {
          type: 'shape',
          modelId,
          name: a.dict._name || '',
          offset: readVec3(t.dict._t),
        };
      }
      p = childEnd;
    }
  }

  if (ascii4(u8, 8) !== 'MAIN') throw new Error('顶层 chunk 不是 MAIN');
  const M = dv.getUint32(16, true);
  parseChildren(20, 20 + M);

  const scene = buildScene(nodes, models.length);
  return { version, models, palette, scene, materials };
}

// 从节点图算出每个 shape 的世界变换, 输出 scene 实例数组.
function buildScene(nodes, modelCount) {
  const parents = {};
  for (const id in nodes) {
    const n = nodes[id];
    if (n.type === 'group') for (const c of n.children) parents[c] = Number(id);
    else if (n.type === 'transform') parents[n.child] = Number(id);
  }

  const instances = [];
  for (const id in nodes) {
    if (nodes[id].type !== 'shape') continue;
    // path: 从 shape 向上回溯到根, 再反转成 root->leaf
    const path = [];
    let cur = Number(id);
    while (cur !== undefined) { path.push(cur); cur = parents[cur]; }
    path.reverse();

    let cumR = ROTATION_MATRICES[0]; // identity
    let cumT = [0, 0, 0];
    let hidden = false;
    let name = '';
    for (const nid of path) {
      const n = nodes[nid];
      if (!n) continue;
      if (n.type === 'transform') {
        cumT = [
          cumT[0] + matVec3(cumR, n.translation)[0],
          cumT[1] + matVec3(cumR, n.translation)[1],
          cumT[2] + matVec3(cumR, n.translation)[2],
        ];
        cumR = matMul3(cumR, ROTATION_MATRICES[n.rotation] || ROTATION_MATRICES[0]);
        if (n.hidden) hidden = true;
        if (n.name) name = n.name;
      } else if (n.type === 'shape') {
        const off = n.offset || [0, 0, 0];
        cumT = [
          cumT[0] + matVec3(cumR, off)[0],
          cumT[1] + matVec3(cumR, off)[1],
          cumT[2] + matVec3(cumR, off)[2],
        ];
        if (n.name) name = n.name;
      } else if (n.type === 'group') {
        if (n.name) name = n.name;
      }
    }
    instances.push({
      modelIndex: nodes[id].modelId,
      translation: cumT.map((v) => Math.round(v)),
      rotation: rotationIndex(cumR),
      hidden: hidden,
      name: name,
    });
  }

  // 老文件(没有场景图): 每个模型给一个 identity 实例
  if (instances.length === 0) {
    const count = modelCount || 0;
    for (let i = 0; i < count; i++) {
      instances.push({ modelIndex: i, translation: [0, 0, 0], rotation: 0, hidden: false, name: '' });
    }
  }
  return instances;
}
