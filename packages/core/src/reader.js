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

// 尝试把一段字节当作嵌套 DICT 解析; 仅当结构恰好耗尽整段时才返回, 否则返回 null.
// 用来识别 MagicaVoxel 的 _f 关键帧块 (DICT 的值是嵌套 DICT).
function tryParseNestedDict(dv, u8, start, end, depth) {
  if (end - start < 4) return null;
  const n = dv.getUint32(start, true);
  if (n < 0 || n > 100000) return null; //  sanity: 普通字符串几乎不会是合法 DICT
  let p = start + 4;
  for (let i = 0; i < n; i++) {
    if (p + 8 > end) return null;
    const klen = dv.getUint32(p, true); p += 4;
    if (p + klen > end) return null;
    p += klen;
    const vlen = dv.getUint32(p, true); p += 4;
    if (p + vlen > end) return null;
    p += vlen;
  }
  if (p !== end) return null; // 必须精确耗尽, 否则当成字符串
  const { dict } = readDict(dv, u8, start, end, depth);
  return dict;
}

// 读取 DICT: int32 numItems; 每项 int32 keyLen + key(str) + int32 valLen + val.
// val 通常是字符串, 但 MagicaVoxel 的 _f 关键帧块里 val 是嵌套 DICT — 自动识别并递归解析.
function readDict(dv, u8, off, end, depth = 0) {
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
    const vstart = p;
    let val;
    if (depth < 4) {
      const nested = tryParseNestedDict(dv, u8, vstart, vstart + vlen, depth + 1);
      if (nested) {
        val = nested;
      } else {
        let s = '';
        for (let j = 0; j < vlen; j++) s += String.fromCharCode(u8[vstart + j]);
        val = s;
      }
    } else {
      let s = '';
      for (let j = 0; j < vlen; j++) s += String.fromCharCode(u8[vstart + j]);
      val = s;
    }
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
  let frameCount = 1;        // 时间轴帧数; 无动画文件默认为 1

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
      } else if (id === 'FRAM') {
        // 时间轴总帧数: dict._f = 帧数
        const { dict } = readDict(dv, u8, contentStart, contentEnd);
        frameCount = dict._f !== undefined ? (parseInt(dict._f, 10) || 1) : 1;
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
        // 动画关键帧: 变换 dict 含嵌套 _f 块 { _f:帧数, _t:平移串, _r:旋转串, _p:枢轴串 }
        let keyframes = null;
        if (td._f && typeof td._f === 'object') {
          const fc = parseInt(td._f._f, 10) || 1;
          const ts = (td._f._t || '').trim().split(/\s+/).filter(Boolean).map(Number);
          const rs = (td._f._r || '').trim().split(/\s+/).filter(Boolean).map(Number);
          const ps = (td._f._p || '').trim().split(/\s+/).filter(Boolean).map(Number);
          keyframes = [];
          for (let k = 0; k < fc; k++) {
            keyframes.push({
              translation: [ts[k * 3] || 0, ts[k * 3 + 1] || 0, ts[k * 3 + 2] || 0],
              rotation: rs[k] || 0,
              pivot: [ps[k * 3] || 0, ps[k * 3 + 1] || 0, ps[k * 3 + 2] || 0],
            });
          }
        }
        nodes[nodeId] = {
          type: 'transform',
          child: childNodeId,
          name: a.dict._name || '',
          hidden: a.dict._hidden === '1',
          translation: readVec3(td._t),
          rotation: td._r !== undefined ? (parseInt(td._r, 10) || 0) : 0,
          keyframes,
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

  // 若某些节点带了关键帧但 FRAM 块缺失, 以最长关键帧为准
  for (const id in nodes) {
    const n = nodes[id];
    if (n.type === 'transform' && n.keyframes && n.keyframes.length > frameCount) {
      frameCount = n.keyframes.length;
    }
  }

  const scene = buildScene(nodes, models.length, frameCount);
  return { version, models, palette, scene, materials, frameCount };
}

// 从节点图算出每个 shape 的逐帧世界变换, 输出 scene 实例数组.
// 每个实例带 frames[frameCount] = { translation, rotation } (每帧世界变换);
// 静态文件 (frameCount===1) 不附加 frames 键, 保持向后兼容.
function buildScene(nodes, modelCount, frameCount) {
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

    // hidden / name / hasAnim 与帧无关, 先遍历一次确定
    let hidden = false;
    let name = '';
    let hasAnim = false;
    for (const nid of path) {
      const n = nodes[nid];
      if (!n) continue;
      if (n.type === 'transform') {
        if (n.hidden) hidden = true;
        if (n.name) name = n.name;
        if (n.keyframes && n.keyframes.length) hasAnim = true;
      } else if (n.type === 'shape') {
        if (n.name) name = n.name;
      } else if (n.type === 'group') {
        if (n.name) name = n.name;
      }
    }

    const frames = [];
    for (let f = 0; f < frameCount; f++) {
      let cumR = ROTATION_MATRICES[0]; // identity
      let cumT = [0, 0, 0];
      for (const nid of path) {
        const n = nodes[nid];
        if (!n) continue;
        if (n.type === 'transform') {
          // 取该帧的变换 (无关键帧用静态值; 关键帧越界夹到末帧)
          const kf = n.keyframes && n.keyframes.length
            ? n.keyframes[Math.min(f, n.keyframes.length - 1)]
            : { translation: n.translation, rotation: n.rotation, pivot: [0, 0, 0] };
          const p = kf.pivot || [0, 0, 0];
          const R = ROTATION_MATRICES[kf.rotation] || ROTATION_MATRICES[0];
          // 枢轴合成: 平移增量 tInc = p + R·(-p); 整体平移 = cumT + cumR·(tInc + kf.translation)
          const rp = matVec3(R, [-p[0], -p[1], -p[2]]);
          const tInc = [p[0] + rp[0], p[1] + rp[1], p[2] + rp[2]];
          const tLocal = [
            tInc[0] + (kf.translation[0] || 0),
            tInc[1] + (kf.translation[1] || 0),
            tInc[2] + (kf.translation[2] || 0),
          ];
          cumT = [
            cumT[0] + matVec3(cumR, tLocal)[0],
            cumT[1] + matVec3(cumR, tLocal)[1],
            cumT[2] + matVec3(cumR, tLocal)[2],
          ];
          cumR = matMul3(cumR, R);
        } else if (n.type === 'shape') {
          const off = n.offset || [0, 0, 0];
          cumT = [
            cumT[0] + matVec3(cumR, off)[0],
            cumT[1] + matVec3(cumR, off)[1],
            cumT[2] + matVec3(cumR, off)[2],
          ];
        }
      }
      frames.push({
        translation: cumT.map((v) => Math.round(v)),
        rotation: rotationIndex(cumR),
      });
    }

    instances.push({
      modelIndex: nodes[id].modelId,
      translation: frames[0].translation,
      rotation: frames[0].rotation,
      hidden,
      name,
      // 仅当路径上真的有关键帧节点才附加 frames, 保持静态文件(及动画里的静态对象)无损
      frames: hasAnim ? frames : undefined,
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
