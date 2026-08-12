// VOX writer (pure JS, browser/Node通用的).
//
// - toVoxBytes(grid, palette):           单模型 (VoxelGrid) -> .vox 二进制 (向后兼容)
// - toVoxBytesScene(data, palette):      多模型 + 场景图 + 材质 -> .vox 二进制 (支持往返)
// - downloadVox(...):                    浏览器下载辅助
//
// 场景图块顺序: SIZE/XYZI (每个模型) -> RGBA -> MATL -> nGRP/nTRN/nSHP.
import { MAGIC, VERSION } from './constants.js';

function str4(s) {
  const b = new Uint8Array(4);
  for (let i = 0; i < 4; i++) b[i] = s.charCodeAt(i) & 0xff;
  return b;
}

function concat(...arrays) {
  let len = 0;
  for (const a of arrays) len += a.length;
  const out = new Uint8Array(len);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}

// chunk: id(4) | N(uint32 LE) | M(uint32 LE) | content
function chunk(id, content, M = 0) {
  const head = new Uint8Array(12);
  const dv = new DataView(head.buffer);
  head.set(str4(id), 0);
  dv.setUint32(4, content.length, true);
  dv.setUint32(8, M, true);
  return concat(head, content);
}

function sizeChunk(sx, sy, sz) {
  const c = new Uint8Array(12);
  const dv = new DataView(c.buffer);
  dv.setUint32(0, sx, true);
  dv.setUint32(4, sy, true);
  dv.setUint32(8, sz, true);
  return chunk('SIZE', c);
}

function xyziChunk(voxels) {
  const c = new Uint8Array(4 + voxels.length * 4);
  const dv = new DataView(c.buffer);
  dv.setUint32(0, voxels.length, true);
  let off = 4;
  for (const v of voxels) {
    c[off] = v.x; c[off + 1] = v.y; c[off + 2] = v.z; c[off + 3] = v.i;
    off += 4;
  }
  return chunk('XYZI', c);
}

function rgbaChunk(palette) {
  const c = new Uint8Array(256 * 4);
  let off = 0;
  // 官方映射: stream[i](0..254) -> 调色板索引 i+1 ; stream[255] -> 索引 0
  for (let i = 0; i < 255; i++) {
    const [r, g, b, a] = palette[i + 1];
    c[off++] = r; c[off++] = g; c[off++] = b; c[off++] = a;
  }
  const [r, g, b, a] = palette[0];
  c[off++] = r; c[off++] = g; c[off++] = b; c[off++] = a;
  return chunk('RGBA', c);
}

// DICT: int32 numItems; 每项 int32 keyLen + key(str) + int32 valLen + val(str)
// val 既可以是字符串, 也可以是嵌套 DICT (MagicaVoxel 的 _f 关键帧块, 值为 DICT).
function dictToBytes(dict) {
  const keys = Object.keys(dict);
  const parts = [];
  const head = new Uint8Array(4);
  new DataView(head.buffer).setUint32(0, keys.length, true);
  parts.push(head);
  for (const k of keys) {
    const raw = dict[k];
    let vb;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      vb = dictToBytes(raw); // 嵌套 DICT (动画 _f 关键帧块)
    } else {
      vb = new TextEncoder().encode(String(raw));
    }
    const kb = new TextEncoder().encode(k);
    const kh = new Uint8Array(4); new DataView(kh.buffer).setUint32(0, kb.length, true);
    const vh = new Uint8Array(4); new DataView(vh.buffer).setUint32(0, vb.length, true);
    parts.push(kh, kb, vh, vb);
  }
  return concat(...parts);
}

// MATL 块: 把高层材质对象写回. 与 parseMaterial 对称 —— 只要材质对象上
// 定义了某字段(含 0/1 默认值), 就写出对应 key, 保证往返无损.
function matlChunk(id, mat) {
  const dict = {};
  dict._type = mat.type || '_diffuse';
  if (mat.metalness !== undefined) dict._metal = String(mat.metalness);
  if (mat.roughness !== undefined) dict._rough = String(mat.roughness);
  if (mat.alpha !== undefined) dict._alpha = String(mat.alpha);
  if (mat.emissive !== undefined) dict._emit = String(mat.emissive);
  if (mat.ior !== undefined) dict._ior = String(mat.ior);
  if (mat.flux !== undefined) dict._flux = String(mat.flux);
  if (mat.density !== undefined) dict._d = String(mat.density);
  if (mat.specular !== undefined) dict._sp = String(mat.specular);
  if (mat.glow !== undefined) dict._g = String(mat.glow);
  const c = new Uint8Array(4);
  new DataView(c.buffer).setUint32(0, id, true);
  return chunk('MATL', concat(c, dictToBytes(dict)));
}

function nTRNChunk(nodeId, childId, { name = '', translation = [0, 0, 0], rotation = 0, hidden = false, keyframes = null }) {
  const nodeDict = {};
  if (name) nodeDict._name = name;
  if (hidden) nodeDict._hidden = '1';
  const trnDict = { _t: translation.join(' '), _r: String(rotation) };
  // 动画: keyframes 是逐帧世界变换 [{translation, rotation}]; 用嵌套 _f 块写出.
  // 写入枢轴全 0, 使单变换节点在重解析时直接还原为世界变换(无损往返).
  if (keyframes && keyframes.length > 1) {
    const fc = keyframes.length;
    const ts = keyframes.map((kf) => (kf.translation || [0, 0, 0]).join(' ')).join(' ');
    const rs = keyframes.map((kf) => String(kf.rotation || 0)).join(' ');
    const ps = keyframes.map(() => '0 0 0').join(' ');
    trnDict._f = { _f: String(fc), _t: ts, _r: rs, _p: ps };
  }
  const cId = new Uint8Array(4);
  new DataView(cId.buffer).setUint32(0, nodeId, true);
  const cChild = new Uint8Array(4);
  new DataView(cChild.buffer).setUint32(0, childId, true);
  const reserved = new Uint8Array(4); // 已废弃, 恒 0
  return chunk('nTRN', concat(cId, dictToBytes(nodeDict), cChild, reserved, dictToBytes(trnDict)));
}

function nGRPChunk(nodeId, children) {
  const cId = new Uint8Array(4);
  new DataView(cId.buffer).setUint32(0, nodeId, true);
  const cNum = new Uint8Array(4);
  new DataView(cNum.buffer).setUint32(0, children.length, true);
  const cChildren = new Uint8Array(children.length * 4);
  const dv = new DataView(cChildren.buffer);
  for (let i = 0; i < children.length; i++) dv.setUint32(i * 4, children[i], true);
  return chunk('nGRP', concat(cId, dictToBytes({}), cNum, cChildren));
}

function nSHPChunk(nodeId, modelId) {
  const cId = new Uint8Array(4);
  new DataView(cId.buffer).setUint32(0, nodeId, true);
  const cModel = new Uint8Array(4);
  new DataView(cModel.buffer).setUint32(0, modelId, true);
  return chunk('nSHP', concat(cId, dictToBytes({}), cModel, dictToBytes({ _t: '0 0 0' })));
}

// 把 VoxelGrid 打包成完整 .vox 的 Uint8Array (单模型, 向后兼容).
export function toVoxBytes(grid, palette = null) {
  const voxels = grid.list();
  let children = concat(sizeChunk(grid.sx, grid.sy, grid.sz), xyziChunk(voxels));
  if (palette) {
    if (palette.length !== 256) throw new Error('palette 必须有 256 项');
    children = concat(children, rgbaChunk(palette));
  }
  const main = chunk('MAIN', new Uint8Array(0), children.length);
  const header = new Uint8Array(8);
  header.set(MAGIC, 0);
  new DataView(header.buffer).setUint32(4, VERSION, true);
  return concat(header, main, children);
}

/**
 * 把多模型场景打包成 .vox 二进制 (支持场景图与材质, 可往返).
 * @param {{models:Array, scene?:Array, materials?:object, frameCount?:number}} data
 *   models: [{ size:[sx,sy,sz], voxels:[{x,y,z,i}] }]
 *   scene:  [{ modelIndex, translation:[x,y,z], rotation, hidden?, name?, frames? }]
 *           frames 为逐帧世界变换 [{translation, rotation}], 存在即表示动画.
 *           省略时每个模型生成一个 identity 实例
 *   materials: { [id]: { type, metalness, roughness, alpha, emissive } }
 *   frameCount: 时间轴总帧数; 省略时由 scene 中 frames 的最大长度推断
 * @param {Array|null} palette 长度256的 [[r,g,b,a],...]
 */
export function toVoxBytesScene(data, palette = null) {
  const models = data.models || [];
  const scene = data.scene && data.scene.length
    ? data.scene
    : models.map((_, i) => ({ modelIndex: i, translation: [0, 0, 0], rotation: 0, hidden: false, name: '' }));
  const materials = data.materials || {};
  // 帧数: 显式给定优先; 否则取最长动画轨道
  const frameCount = data.frameCount && data.frameCount > 1
    ? data.frameCount
    : scene.reduce((m, inst) => Math.max(m, inst.frames ? inst.frames.length : 1), 1);

  let children = new Uint8Array(0);
  for (const m of models) {
    children = concat(children, sizeChunk(m.size[0], m.size[1], m.size[2]), xyziChunk(m.voxels));
  }
  if (palette) {
    if (palette.length !== 256) throw new Error('palette 必须有 256 项');
    children = concat(children, rgbaChunk(palette));
  }
  for (const id in materials) children = concat(children, matlChunk(Number(id), materials[id]));

  // 时间轴总帧数 (动画文件才写)
  if (frameCount > 1) {
    const fc = new Uint8Array(4);
    new DataView(fc.buffer).setUint32(0, frameCount, true);
    children = concat(children, chunk('FRAM', dictToBytes({ _f: String(frameCount) })));
  }

  // 场景图: 根 nGRP(0) -> 每个实例一个 nTRN -> nSHP
  const N = scene.length;
  const groupId = 0;
  const trnIds = [];
  const shpIds = [];
  for (let j = 0; j < N; j++) { trnIds.push(1 + j); shpIds.push(1 + N + j); }
  children = concat(children, nGRPChunk(groupId, trnIds));
  for (let j = 0; j < N; j++) {
    const inst = scene[j];
    children = concat(
      children,
      nTRNChunk(trnIds[j], shpIds[j], {
        name: inst.name || '',
        translation: inst.translation || [0, 0, 0],
        rotation: inst.rotation || 0,
        hidden: !!inst.hidden,
        keyframes: inst.frames && inst.frames.length > 1 ? inst.frames : null,
      }),
      nSHPChunk(shpIds[j], inst.modelIndex),
    );
  }

  const main = chunk('MAIN', new Uint8Array(0), children.length);
  const header = new Uint8Array(8);
  header.set(MAGIC, 0);
  new DataView(header.buffer).setUint32(4, VERSION, true);
  return concat(header, main, children);
}

// 浏览器下载辅助 (可选)
export function downloadVox(grid, filename = 'model.vox', palette = null) {
  const bytes = toVoxBytes(grid, palette);
  const blob = new Blob([bytes], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
