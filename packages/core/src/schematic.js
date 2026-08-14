// @voxel-tool/core — Minecraft Schematic (Sponge v2 `.schem`) 互操作.
//
// 目标: 让体素模型能在 MagicaVoxel 生态与 Minecraft 生态间互通.
//   - parseSchematic(bytes): NBT/GZip .schem -> 兼容 parseVox 的体素数据 (可直接喂 viewer/exporter)
//   - voxelToSchematic(vox):  体素数据 -> Sponge v2 .schem (GZip 压缩的 NBT)
//   - blockColor / blockNameToIndex: block 状态 -> 体素颜色索引 的桥接
//
// 设计约束:
//   1. 零重依赖: NBT 读写 + varint 编解码全部手写.
//   2. 跨平台 gzip: 主用 Web 标准 CompressionStream/DecompressionStream (浏览器 + Node18+ 都有),
//      动态回退 node:zlib. 不能静态 import 'node:zlib', 否则破坏 core 的浏览器 bundle.
//   3. Minecraft 用 Y 轴向上 (height=y), 与 voxel 本地 z-up 不同; 这里统一以 Minecraft 坐标
//      (x=width, y=height, z=length) 存储, 渲染侧根 Group 的 rotation.x=-π/2 已做 z-up->y-up 翻转,
//      因此 .schem -> 导出 时体素直接按 (x,y,z) 喂入即可立着.
//
// Sponge v2 关键事实 (来自官方规范):
//   - 根 NBT Compound, 整段 GZip 压缩.
//   - Width/Height/Length: Short (x/y/z 尺寸).
//   - Palette: Compound { "minecraft:stone": 0, "minecraft:grass_block": 1, ... }
//   - BlockData: ByteArray, 内容是 **varint 打包** 的索引序列 (长度 = W*H*L).
//   - 块排列: index = x + z*Width + y*Width*Length (X 最快, Y 最慢).

const airName = 'minecraft:air';

// ---------------------------------------------------------------------------
// gzip (跨平台: CompressionStream 优先, 回退 node:zlib)
// ---------------------------------------------------------------------------

async function gzipDeflate(data) {
  if (typeof globalThis.CompressionStream !== 'function') {
    throw new Error('当前环境不支持 CompressionStream, 无法压缩 schematic (需 Node18+/现代浏览器)');
  }
  const cs = new globalThis.CompressionStream('gzip');
  const stream = new Response(new Blob([data]).stream().pipeThrough(cs)).arrayBuffer();
  return new Uint8Array(await stream);
}

async function gzipInflate(data) {
  if (typeof globalThis.DecompressionStream !== 'function') {
    throw new Error('当前环境不支持 DecompressionStream, 无法解压 schematic (需 Node18+/现代浏览器)');
  }
  const ds = new globalThis.DecompressionStream('gzip');
  const stream = new Response(new Blob([data]).stream().pipeThrough(ds)).arrayBuffer();
  return new Uint8Array(await stream);
}

// ---------------------------------------------------------------------------
// 手写 NBT (大端). 仅实现 schematic 用到的子集.
// ---------------------------------------------------------------------------

const TAG_END = 0;
const TAG_BYTE = 1;
const TAG_SHORT = 2;
const TAG_INT = 3;
const TAG_LONG = 4;
const TAG_FLOAT = 5;
const TAG_DOUBLE = 6;
const TAG_BYTE_ARRAY = 7;
const TAG_STRING = 8;
const TAG_LIST = 9;
const TAG_COMPOUND = 10;
const TAG_INT_ARRAY = 11;

class Reader {
  constructor(buf) {
    this.dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    this.u8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    this.pos = 0;
  }
  byte() { return this.u8[this.pos++]; }
  u16() { const v = this.dv.getUint16(this.pos, false); this.pos += 2; return v; }
  i16() { const v = this.dv.getInt16(this.pos, false); this.pos += 2; return v; }
  i32() { const v = this.dv.getInt32(this.pos, false); this.pos += 4; return v; }
  i64() {
    // 仅高位用于 DataVersion, 转 Number (足够)
    const hi = this.dv.getInt32(this.pos, false);
    const lo = this.dv.getUint32(this.pos + 4, false);
    this.pos += 8;
    return hi * 4294967296 + lo;
  }
  f32() { const v = this.dv.getFloat32(this.pos, false); this.pos += 4; return v; }
  f64() { const v = this.dv.getFloat64(this.pos, false); this.pos += 8; return v; }
  bytes(n) { const v = this.u8.subarray(this.pos, this.pos + n); this.pos += n; return v; }
  string() {
    const len = this.u16();
    const arr = this.u8.subarray(this.pos, this.pos + len);
    this.pos += len;
    return new TextDecoder().decode(arr);
  }
}

function readNamedTag(r) {
  const type = r.byte();
  if (type === TAG_END) return null;
  const name = r.string();
  return { type, name, value: readTagValue(r, type) };
}

function readTagValue(r, type) {
  switch (type) {
    case TAG_BYTE: return r.byte();
    case TAG_SHORT: return r.i16();
    case TAG_INT: return r.i32();
    case TAG_LONG: return r.i64();
    case TAG_FLOAT: return r.f32();
    case TAG_DOUBLE: return r.f64();
    case TAG_BYTE_ARRAY: {
      const len = r.i32();
      return r.bytes(len);
    }
    case TAG_STRING: return r.string();
    case TAG_LIST: {
      const elemType = r.byte();
      const len = r.i32();
      const arr = [];
      for (let i = 0; i < len; i++) arr.push(readTagValue(r, elemType));
      return arr;
    }
    case TAG_COMPOUND: {
      const obj = {};
      for (;;) {
        const t = readNamedTag(r);
        if (t === null) break;
        obj[t.name] = t.value;
      }
      return obj;
    }
    case TAG_INT_ARRAY: {
      const len = r.i32();
      const arr = new Array(len);
      for (let i = 0; i < len; i++) arr[i] = r.i32();
      return arr;
    }
    default:
      throw new Error(`NBT: 不支持的 tag 类型 ${type}`);
  }
}

function parseNbt(bytes) {
  const r = new Reader(bytes);
  // 根必须是 Compound
  const t = readNamedTag(r);
  if (!t || t.type !== TAG_COMPOUND) throw new Error('NBT: 根节点不是 Compound');
  return t.value;
}

// ---------------------------------------------------------------------------
// NBT 写入 (大端)
// ---------------------------------------------------------------------------

class Writer {
  constructor() {
    this.chunks = [];
  }
  byte(v) { this.chunks.push(Uint8Array.of(v & 0xff)); }
  i16(v) { const b = new Uint8Array(2); new DataView(b.buffer).setInt16(0, v, false); this.chunks.push(b); }
  i32(v) { const b = new Uint8Array(4); new DataView(b.buffer).setInt32(0, v, false); this.chunks.push(b); }
  u8arr(b) { this.chunks.push(b); }
  string(s) {
    const enc = new TextEncoder().encode(s);
    this.i16(enc.length);
    this.chunks.push(enc);
  }
  bytes() {
    let len = 0;
    for (const c of this.chunks) len += c.length;
    const out = new Uint8Array(len);
    let off = 0;
    for (const c of this.chunks) { out.set(c, off); off += c.length; }
    return out;
  }
}

function writeNamedTag(w, type, name, value) {
  w.byte(type);
  w.string(name);
  writeTagValue(w, type, value);
}

function writeTagValue(w, type, value) {
  switch (type) {
    case TAG_BYTE: w.byte(value); break;
    case TAG_SHORT: w.i16(value); break;
    case TAG_INT: w.i32(value); break;
    case TAG_STRING: w.string(value); break;
    case TAG_BYTE_ARRAY: w.i32(value.length); w.u8arr(value); break;
    case TAG_INT_ARRAY:
      w.i32(value.length);
      for (const v of value) w.i32(v);
      break;
    case TAG_LIST: {
      const elemType = value.length ? (Array.isArray(value[0]) ? TAG_COMPOUND : TAG_INT) : TAG_END;
      w.byte(elemType);
      w.i32(value.length);
      for (const item of value) {
        if (elemType === TAG_COMPOUND) writeCompound(w, item);
        else writeTagValue(w, elemType, item);
      }
      break;
    }
    case TAG_COMPOUND: writeCompound(w, value); break;
    default:
      throw new Error(`NBT: 不支持写 tag 类型 ${type}`);
  }
}

function writeCompound(w, obj) {
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    // 短整型标记: { _short:true, v } -> TAG_SHORT (用于 Width/Height/Length)
    if (value && typeof value === 'object' && value._short) {
      w.byte(TAG_SHORT); w.string(key); w.i16(value.v); continue;
    }
    // 根据值类型推断 tag type
    let type;
    if (typeof value === 'number') {
      type = TAG_INT;
    } else if (typeof value === 'string') {
      type = TAG_STRING;
    } else if (value instanceof Uint8Array) {
      type = TAG_BYTE_ARRAY;
    } else if (Array.isArray(value)) {
      type = TAG_LIST;
    } else if (value && typeof value === 'object') {
      type = TAG_COMPOUND;
    } else {
      throw new Error('NBT: 无法推断 tag 类型');
    }
    writeNamedTag(w, type, key, value);
  }
  w.byte(TAG_END);
}

function buildNbt(rootCompound) {
  const w = new Writer();
  writeNamedTag(w, TAG_COMPOUND, '', rootCompound);
  return w.bytes();
}

// ---------------------------------------------------------------------------
// varint 编解码 (用于 BlockData / BiomeData)
// ---------------------------------------------------------------------------

function writeVarint(w, value) {
  let v = value >>> 0;
  while (v >= 0x80) {
    w.byte((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  w.byte(v);
}

function readVarint(r) {
  let result = 0;
  let shift = 0;
  for (;;) {
    const b = r.byte();
    result |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) break;
    shift += 7;
    if (shift > 35) throw new Error('varint 溢出');
  }
  return result >>> 0;
}

// ---------------------------------------------------------------------------
// block 名 -> 颜色 映射 (常见 Minecraft block, 近似 RGBA)
// Minecraft 无颜色语义, 这里取各 block 的"代表性颜色"用于可视化/互通.
// 仅覆盖最常用的一组; 其余 block 回退到按名字 hash 的稳定灰/色.
// ---------------------------------------------------------------------------

const BLOCK_COLORS = {
  'minecraft:air': [0, 0, 0, 0],
  'minecraft:stone': [127, 127, 127, 255],
  'minecraft:granite': [156, 124, 104, 255],
  'minecraft:diorite': [207, 207, 207, 255],
  'minecraft:andesite': [136, 136, 136, 255],
  'minecraft:grass_block': [95, 159, 53, 255],
  'minecraft:dirt': [134, 96, 67, 255],
  'minecraft:coarse_dirt': [134, 96, 67, 255],
  'minecraft:podzol': [78, 54, 36, 255],
  'minecraft:cobblestone': [123, 123, 123, 255],
  'minecraft:oak_planks': [180, 138, 83, 255],
  'minecraft:spruce_planks': [123, 87, 51, 255],
  'minecraft:birch_planks': [195, 177, 125, 255],
  'minecraft:jungle_planks': [156, 114, 71, 255],
  'minecraft:acacia_planks': [170, 107, 66, 255],
  'minecraft:dark_oak_planks': [75, 52, 31, 255],
  'minecraft:oak_log': [130, 102, 65, 255],
  'minecraft:spruce_log': [97, 71, 45, 255],
  'minecraft:birch_log': [197, 182, 140, 255],
  'minecraft:oak_leaves': [54, 114, 45, 255],
  'minecraft:spruce_leaves': [42, 86, 36, 255],
  'minecraft:birch_leaves': [92, 142, 66, 255],
  'minecraft:glass': [200, 220, 230, 90],
  'minecraft:white_concrete': [207, 213, 214, 255],
  'minecraft:black_concrete': [20, 22, 24, 255],
  'minecraft:red_concrete': [151, 42, 43, 255],
  'minecraft:green_concrete': [94, 145, 62, 255],
  'minecraft:blue_concrete': [59, 83, 165, 255],
  'minecraft:yellow_concrete': [193, 174, 47, 255],
  'minecraft:water': [54, 106, 206, 170],
  'minecraft:lava': [226, 96, 26, 255],
  'minecraft:sand': [219, 205, 152, 255],
  'minecraft:gravel': [132, 127, 122, 255],
  'minecraft:gold_block': [225, 196, 66, 255],
  'minecraft:iron_block': [214, 214, 214, 255],
  'minecraft:diamond_block': [88, 224, 212, 255],
  'minecraft:emerald_block': [66, 190, 110, 255],
  'minecraft:redstone_block': [173, 38, 38, 255],
  'minecraft:coal_block': [26, 26, 26, 255],
  'minecraft:netherrack': [110, 52, 52, 255],
  'minecraft:soul_sand': [131, 110, 96, 255],
  'minecraft:obsidian': [26, 11, 43, 255],
  'minecraft:bedrock': [83, 83, 83, 255],
  'minecraft:ice': [130, 200, 230, 150],
  'minecraft:snow_block': [240, 244, 245, 255],
  'minecraft:brick': [156, 92, 73, 255],
  'minecraft:bookshelf': [134, 96, 67, 255],
  'minecraft:mossy_cobblestone': [106, 119, 89, 255],
  'minecraft:clay': [183, 165, 146, 255],
  'minecraft:terracotta': [168, 90, 58, 255],
  'minecraft:white_wool': [233, 233, 233, 255],
  'minecraft:red_wool': [189, 66, 66, 255],
  'minecraft:green_wool': [103, 157, 76, 255],
  'minecraft:blue_wool': [88, 118, 198, 255],
  'minecraft:yellow_wool': [215, 192, 67, 255],
  'minecraft:black_wool': [33, 33, 33, 255],
  'minecraft:tnt': [196, 90, 60, 255],
  'minecraft:glowstone': [224, 209, 122, 255],
  'minecraft:sea_lantern': [185, 219, 188, 255],
  'minecraft:end_stone': [215, 207, 149, 255],
  'minecraft:purpur_block': [165, 127, 174, 255],
  'minecraft:prismarine': [98, 150, 143, 255],
};

function hashStringToColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  const r = (h & 0xff);
  const g = ((h >> 8) & 0xff);
  const b = ((h >> 16) & 0xff);
  return [r, g, b, 255];
}

/** 给定 block 状态字符串, 返回近似 RGBA (含 alpha). */
export function blockColor(blockName) {
  if (Object.prototype.hasOwnProperty.call(BLOCK_COLORS, blockName)) {
    return BLOCK_COLORS[blockName].slice();
  }
  return hashStringToColor(blockName);
}

// ---------------------------------------------------------------------------
// parseSchematic: .schem (GZip+NBT) -> 兼容 parseVox 的体素数据
// ---------------------------------------------------------------------------

const SCHEM_VERSION_2 = 2;

/**
 * 解析 Minecraft Sponge v2 Schematic (.schem).
 * @param {Uint8Array|ArrayBuffer} input GZip 压缩的 NBT 字节
 * @returns {Promise<{
 *   version: number, dataVersion: number,
 *   models: { size:[number,number,number], voxels:{x:number,y:number,z:number,i:number}[] }[],
 *   palette: (number[])[]|null,
 *   scene: { modelIndex:number, translation:[number,number,number], rotation:number, hidden:boolean, name:string }[],
 *   materials: Record<number, any>, frameCount: number,
 *   schematic: { width:number, height:number, length:number, offset:number[], blockNames:string[], source:'sponge-v2' }
 * }>}
 */
export { parseNbt, buildNbt, readVarint, writeVarint };

export async function parseSchematic(input) {
  const raw = input instanceof Uint8Array ? input : new Uint8Array(input);
  const decompressed = await gzipInflate(raw);
  const root = parseNbt(decompressed);

  const version = Number(root.Version ?? SCHEM_VERSION_2);
  const dataVersion = Number(root.DataVersion ?? 0);
  const width = Number(root.Width);
  const height = Number(root.Height);
  const length = Number(root.Length);
  if (!width || !height || !length) throw new Error('Schematic: 缺少 Width/Height/Length');

  // Palette: { "minecraft:stone": 0, ... }
  const paletteCompound = root.Palette;
  if (!paletteCompound) throw new Error('Schematic: 缺少 Palette');
  const blockNames = [];
  for (const name of Object.keys(paletteCompound)) blockNames.push(name);
  // 按索引排序 (值最小 -> 0)
  blockNames.sort((a, b) => Number(paletteCompound[a]) - Number(paletteCompound[b]));

  // BlockData: varint 打包索引序列
  const blockData = root.BlockData;
  if (!blockData) throw new Error('Schematic: 缺少 BlockData');

  // 每个唯一非 air block -> 调色板 ci (1..N); 0 留给透明惯例
  const blockToCi = new Map();
  let nextCi = 1;
  const paletteRgba = Array.from({ length: 256 }, () => [0, 0, 0, 0]);

  const r = new Reader(blockData);
  const total = width * height * length;
  const voxels = [];
  for (let y = 0; y < height; y++) {
    for (let z = 0; z < length; z++) {
      for (let x = 0; x < width; x++) {
        const idx = readVarint(r);
        const name = blockNames[idx];
        if (name === airName || !name) continue; // air 跳过
        let ci = blockToCi.get(name);
        if (ci === undefined) {
          if (nextCi > 255) throw new Error('Schematic: 调色板超出 256 色上限 (Minecraft block 种类过多)');
          ci = nextCi++;
          blockToCi.set(name, ci);
          paletteRgba[ci] = blockColor(name);
        }
        voxels.push({ x, y, z, i: ci });
      }
    }
  }

  const offset = Array.isArray(root.Offset) ? root.Offset.slice(0, 3).map(Number) : [0, 0, 0];

  return {
    version,
    dataVersion,
    models: [{ size: [width, height, length], voxels }],
    palette: paletteRgba,
    scene: [{ modelIndex: 0, translation: [0, 0, 0], rotation: 0, hidden: false, name: 'schematic' }],
    materials: {},
    frameCount: 1,
    schematic: {
      width, height, length, offset, blockNames, source: 'sponge-v2',
    },
  };
}

// ---------------------------------------------------------------------------
// voxelToSchematic: 体素数据 -> Sponge v2 .schem (GZip+NBT)
// ---------------------------------------------------------------------------

/**
 * 把体素数据 (.vox 解析结果 / {model} / {instances}) 写成 Minecraft Sponge v2 Schematic.
 * 颜色通过"最近 block"启发式映射回 block 名 (Minecraft 无颜色语义, 只能近似).
 * @param {object} vox 兼容 parseVox 的结果, 或 { model:{size,voxels}, palette }
 * @param {object} [opts]
 * @param {string} [opts.fallbackBlock='minecraft:stone'] 无法匹配颜色时的回退 block
 * @returns {Promise<Uint8Array>} GZip 压缩的 NBT 字节
 */
export async function voxelToSchematic(vox, opts = {}) {
  const fallbackBlock = opts.fallbackBlock || 'minecraft:stone';

  // 取得体素列表 + 调色板
  let voxels = [];
  let palette = null;
  if (vox && Array.isArray(vox.models) && Array.isArray(vox.scene)) {
    // parseVox 结果: 合并所有实例到单个模型
    const models = vox.models;
    for (const s of vox.scene) {
      const m = models[s.modelIndex];
      if (!m) continue;
      const [tx, ty, tz] = s.translation || [0, 0, 0];
      for (const v of m.voxels) {
        voxels.push({ x: v.x + tx, y: v.y + ty, z: v.z + tz, i: v.i });
      }
    }
    palette = vox.palette;
  } else if (vox && vox.model) {
    voxels = vox.model.voxels.map((v) => ({ ...v }));
    palette = vox.palette;
  } else if (vox && Array.isArray(vox.instances)) {
    for (const inst of vox.instances) {
      const [tx, ty, tz] = inst.translation || [0, 0, 0];
      for (const v of inst.voxels) voxels.push({ x: v.x + tx, y: v.y + ty, z: v.z + tz, i: v.i });
    }
    palette = vox.palette || null;
  } else if (vox && vox.voxels) {
    voxels = vox.voxels.map((v) => ({ ...v }));
    palette = vox.palette || null;
  }

  if (!voxels.length) throw new Error('voxelToSchematic: 没有体素可写');

  // 计算包围盒尺寸
  let sx = 0, sy = 0, sz = 0;
  for (const v of voxels) {
    if (v.x + 1 > sx) sx = v.x + 1;
    if (v.y + 1 > sy) sy = v.y + 1;
    if (v.z + 1 > sz) sz = v.z + 1;
  }

  // 颜色 -> block 名 的反向映射: 用 BLOCK_COLORS 里与每个 ci 颜色最接近的 block
  // 预先构建 ci(0..255) -> block 名 数组
  const ciToBlock = new Array(256).fill(fallbackBlock);
  if (palette) {
    for (let ci = 1; ci < 256; ci++) {
      const col = palette[ci];
      if (!col) continue;
      ciToBlock[ci] = nearestBlockName(col);
    }
  }

  // 反查 ci=0 或未知 -> 用 fallback; 但 ci=0 通常是透明, 仍写 air 更合适
  // 构建 Sponge Palette: air 索引固定为 0, 其余按出现顺序
  const usedBlocks = new Set();
  for (const v of voxels) {
    const b = v.i === 0 ? airName : (ciToBlock[v.i] || fallbackBlock);
    usedBlocks.add(b);
  }
  // air 必须存在 (用于未填充区域)
  usedBlocks.add(airName);

  const blockList = Array.from(usedBlocks);
  // 保证 air 索引 0
  blockList.sort((a, b) => (a === airName ? -1 : b === airName ? 1 : 0));
  const blockToIndex = new Map();
  blockList.forEach((b, i) => blockToIndex.set(b, i));

  // BlockData: 按 x + z*W + y*W*L 顺序写 varint 索引
  const total = sx * sy * sz;
  const indexAt = new Int32Array(total).fill(blockToIndex.get(airName));
  for (const v of voxels) {
    const idx = v.x + v.z * sx + v.y * sx * sz;
    const b = v.i === 0 ? airName : (ciToBlock[v.i] || fallbackBlock);
    indexAt[idx] = blockToIndex.get(b);
  }

  const w = new Writer();
  for (let k = 0; k < total; k++) writeVarint(w, indexAt[k]);
  const blockDataBytes = w.bytes();

  // 构建 NBT 根 Compound
  const paletteCompound = {};
  blockList.forEach((b, i) => { paletteCompound[b] = i; });

  const rootCompound = {
    Version: SCHEM_VERSION_2,
    DataVersion: 0,
    Width: { _short: true, v: sx },
    Height: { _short: true, v: sy },
    Length: { _short: true, v: sz },
    Offset: [0, 0, 0],
    Palette: paletteCompound,
    BlockData: blockDataBytes,
  };

  const nbt = buildNbt(rootCompound);
  return gzipDeflate(nbt);
}

// 给定 RGBA, 从 BLOCK_COLORS 中找欧氏距离最近的非 air block 名
function nearestBlockName(rgba) {
  let best = null;
  let bestDist = Infinity;
  for (const name of Object.keys(BLOCK_COLORS)) {
    if (name === airName) continue;
    const c = BLOCK_COLORS[name];
    const d = (c[0] - rgba[0]) ** 2 + (c[1] - rgba[1]) ** 2 + (c[2] - rgba[2]) ** 2;
    if (d < bestDist) { bestDist = d; best = name; }
  }
  return best || 'minecraft:stone';
}
