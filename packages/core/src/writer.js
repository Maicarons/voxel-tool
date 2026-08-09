// VOX 写入器 (纯 JS, 浏览器/Node 通用)
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
  for (const a of arrays) {
    out.set(a, off);
    off += a.length;
  }
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

/**
 * 把 VoxelGrid 打包成完整 .vox 的 Uint8Array。
 * @param {VoxelGrid} grid
 * @param {Array|null} palette 长度256的 [[r,g,b,a],...]; 传 null 则不写 RGBA(用默认调色板)
 */
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
