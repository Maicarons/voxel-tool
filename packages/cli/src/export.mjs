// src/export.mjs —— voxel-export 的核心逻辑 (与 CLI 入口解耦, 便于测试与复用).
//
// 把 MagicaVoxel .vox 文件转成通用 3D 格式 (GLTF/GLB/OBJ/STL/PLY/USDZ/FBX),
// 完全在 Node 下运行, 不需要浏览器。
//
// 依赖:
//   @voxel-tool/core   —— parseVox (读 .vox)
//   @voxel-tool/exporter —— VoxelExporter + toUint8Array (多格式导出)
import './polyfill.mjs';

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, basename, extname } from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import {
  parseVox,
  parseSchematic,
  voxelToSchematic,
  voxelizeMesh,
  voxelCSG,
  VoxelGrid,
  defaultPalette,
  toVoxBytes,
} from '@voxel-tool/core';
import { VoxelExporter, toUint8Array, FORMATS } from '@voxel-tool/exporter';

// 额外支持的体素互操作格式 (不走 exporter 的通用 3D 管线)
const VOXEL_FORMATS = ['vox', 'schem'];
export const ALL_FORMATS = [...FORMATS, ...VOXEL_FORMATS];

export { FORMATS };

/** 返回全部支持的格式数组 (含体素互操作 vox/schem) */
export function listFormats() {
  return ALL_FORMATS;
}

/** 逆向体素化支持的输入扩展名 */
const MESH_INPUT_EXTS = ['.glb', '.gltf', '.obj', '.stl'];

/** 判断输入路径是否为可逆向体素化的网格文件 */
export function isMeshInput(inputPath) {
  return MESH_INPUT_EXTS.includes(extname(inputPath).toLowerCase());
}

// 把一个 three 几何体(可能带 index)转成非索引三角形, 提取顶点位置 + 颜色。
function geometryTriangles(geometry, matrixWorld, fallbackColor) {
  const geo = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = geo.getAttribute('position');
  const colAttr = geo.getAttribute('color');
  const out = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    const a = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(matrixWorld);
    const b = new THREE.Vector3(pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1)).applyMatrix4(matrixWorld);
    const c = new THREE.Vector3(pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2)).applyMatrix4(matrixWorld);
    let color = fallbackColor;
    if (colAttr) {
      // 取三个顶点色的平均 (量化到 0..255)
      const r = (colAttr.getX(i) + colAttr.getX(i + 1) + colAttr.getX(i + 2)) / 3;
      const g = (colAttr.getY(i) + colAttr.getY(i + 1) + colAttr.getY(i + 2)) / 3;
      const bl = (colAttr.getZ(i) + colAttr.getZ(i + 1) + colAttr.getZ(i + 2)) / 3;
      color = [Math.round(r * 255), Math.round(g * 255), Math.round(bl * 255), 255];
    }
    out.push({ a: [a.x, a.y, a.z], b: [b.x, b.y, b.z], c: [c.x, c.y, c.z], color });
  }
  return out;
}

// 从 three Object3D 递归收集全部网格三角形 (应用世界变换)。
function collectTriangles(root) {
  const tris = [];
  root.updateMatrixWorld(true);
  root.traverse((node) => {
    if (node.isMesh && node.geometry) {
      const mat = node.material;
      const fallbackColor = mat && mat.color
        ? [Math.round(mat.color.r * 255), Math.round(mat.color.g * 255), Math.round(mat.color.b * 255), 255]
        : [200, 205, 215, 255];
      tris.push(...geometryTriangles(node.geometry, node.matrixWorld, fallbackColor));
    }
  });
  return tris;
}

/**
 * 把一个通用 3D 网格文件 (.glb/.gltf/.obj/.stl) 逆向体素化为 .vox。
 * 这是 P4.5 逆向互操作: 各种格式 -> 体素, 补齐 vox -> 各种格式 的回路。
 * @param {string} inputPath 输入网格路径
 * @param {object} [opts]
 * @param {string} [opts.output] 输出 .vox 路径; 省略时取 <输入名去扩展>.vox
 * @param {number|number[]} [opts.resolution=64] 体素化分辨率
 * @param {'shell'|'solid'} [opts.mode='shell'] 壳模式(不需封闭) / 实心(需封闭流形)
 * @param {number} [opts.pad=0] 包围盒外扩层数 (留空 margin)
 * @returns {Promise<{ outputPath: string, bytes: Uint8Array }>}
 */
export async function voxelizeModel(inputPath, opts = {}) {
  const { output, resolution = 64, mode = 'shell', pad = 0 } = opts;
  const ext = extname(inputPath).toLowerCase();
  const raw = readFileSync(resolve(inputPath));

  let triangles;
  if (ext === '.glb' || ext === '.gltf') {
    const loader = new GLTFLoader();
    // GLTFLoader.parse 只接受 string(.gltf JSON) 或 ArrayBuffer(.glb 二进制);
    // 传 Uint8Array 会被误当 JSON 文本而失败, 故分别处理。
    const data = ext === '.glb'
      ? raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)
      : raw.toString('utf8');
    const gltf = await new Promise((res, rej) => {
      loader.parse(data, '', res, rej);
    });
    triangles = collectTriangles(gltf.scene);
  } else if (ext === '.obj') {
    const loader = new OBJLoader();
    const text = raw.toString('utf8');
    triangles = collectTriangles(loader.parse(text));
  } else if (ext === '.stl') {
    const loader = new STLLoader();
    // STLLoader.parse 接受 ArrayBuffer
    const geo = loader.parse(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
    triangles = collectTriangles(new THREE.Mesh(geo, new THREE.MeshStandardMaterial()));
  } else {
    throw new Error(`逆向体素化不支持的输入 "${ext}"。支持: ${MESH_INPUT_EXTS.join(', ')}`);
  }

  if (triangles.length === 0) {
    throw new Error('输入网格未解析出任何三角形');
  }

  const { grid, palette } = voxelizeMesh(triangles, { resolution, mode, pad });
  const bytes = toVoxBytes(grid, palette);

  const outPath = output
    ? resolve(output)
    : resolve(basename(inputPath, extname(inputPath)) + '.vox');
  writeFileSync(outPath, Buffer.from(bytes));

  return { outputPath: outPath, bytes };
}

/**
 * 把单个 .vox 文件导出为指定格式并写入磁盘。
 * @param {string} inputPath 输入 .vox 路径
 * @param {object} [opts]
 * @param {string} [opts.format='glb'] 格式: glb|gltf|obj|stl|ply|usdz|fbx
 * @param {string} [opts.output] 输出路径; 省略时取 <输入名去扩展>.<format>
 * @param {boolean} [opts.ascii=false] stl/ply 用 ASCII (默认二进制)
 * @param {boolean} [opts.draco=false] glb/gltf 启用 Draco 几何压缩
 * @returns {Promise<{ outputPath: string, bytes: Uint8Array }>}
 */
export async function exportVoxFile(inputPath, opts = {}) {
  const { format = 'glb', output, ascii = false, draco = false } = opts;
  const fmt = String(format).toLowerCase();
  const known = [...ALL_FORMATS, 'vox'];
  if (!known.includes(fmt)) {
    throw new Error(`不支持的格式 "${fmt}"。支持: ${ALL_FORMATS.join(', ')}`);
  }

  const raw = readFileSync(resolve(inputPath));
  const buf = new Uint8Array(raw);

  // 解析输入: .schem 走 Sponge v2 解析, 其余走 .vox
  const isSchemInput = extname(inputPath).toLowerCase() === '.schem';
  const vox = isSchemInput ? await parseSchematic(buf) : parseVox(buf);

  // 导出为体素互操作格式 (vox/schem): 直接走 core 的回写
  if (fmt === 'schem') {
    const bytes = await voxelToSchematic(vox);
    const outPath = output
      ? resolve(output)
      : resolve(basename(inputPath, extname(inputPath)) + '.schem');
    writeFileSync(outPath, Buffer.from(bytes));
    return { outputPath: outPath, bytes };
  }
  if (fmt === 'vox') {
    // 体素互操作: 用 exporter 的 vox 回写 (无损保留模型/场景/材质)
    const exporter = new VoxelExporter(vox);
    const bytes = await exporter.export('vox');
    const outPath = output
      ? resolve(output)
      : resolve(basename(inputPath, extname(inputPath)) + '.vox');
    writeFileSync(outPath, Buffer.from(bytes));
    return { outputPath: outPath, bytes };
  }

  const exporter = new VoxelExporter(vox);
  const exportOptions = {};
  if (ascii && (fmt === 'stl' || fmt === 'ply')) exportOptions.binary = false;
  // Draco 几何压缩: 仅 glb/gltf 生效, 由 exporter 内部做 KHR_draco_mesh_compression 后处理。
  if (draco && (fmt === 'glb' || fmt === 'gltf')) exportOptions.draco = true;

  const data = await exporter.export(fmt, exportOptions);
  const bytes = toUint8Array(data);

  const outPath = output
    ? resolve(output)
    : resolve(basename(inputPath, extname(inputPath)) + '.' + fmt);
  writeFileSync(outPath, Buffer.from(bytes));

  return { outputPath: outPath, bytes };
}

/**
 * 对两个体素文件 (.vox / .schem) 执行布尔 CSG (并/交/差) 并写回 .vox (P4.6 余下)。
 * 两个文件的调色板会按实际 RGBA 去重合并为统一调色板, 因此跨文件颜色保真。
 * @param {string} aPath 主操作数路径 (.vox/.schem)
 * @param {string} bPath 次操作数路径 (.vox/.schem)
 * @param {'union'|'intersection'|'difference'} op
 * @param {object} [opts]
 * @param {string} [opts.output] 输出 .vox 路径; 省略时取 <a名>_<op>_<b名>.vox
 * @param {'a'|'b'} [opts.colorTie='a'] 冲突处颜色归属
 * @returns {Promise<{ outputPath: string, bytes: Uint8Array, count: number }>}
 */
export async function csgVoxFiles(aPath, bPath, op, opts = {}) {
  const { output, colorTie = 'a' } = opts;
  if (!['union', 'intersection', 'difference'].includes(op)) {
    throw new Error(`不支持的 CSG 运算 "${op}" (应为 union|intersection|difference)`);
  }

  const loadGridAndPalette = async (path) => {
    const raw = new Uint8Array(readFileSync(resolve(path)));
    const isSchem = extname(path).toLowerCase() === '.schem';
    const parsed = isSchem ? await parseSchematic(raw) : parseVox(raw);
    const m = parsed.models[0];
    const pal = parsed.palette && parsed.palette.length === 256 ? parsed.palette : defaultPalette();
    const g = new VoxelGrid(m.size[0], m.size[1], m.size[2]);
    for (const v of m.voxels) g.voxels.set(`${v.x},${v.y},${v.z}`, v.i);
    return { grid: g, palette: pal };
  };

  const { grid: A, palette: pa } = await loadGridAndPalette(aPath);
  const { grid: B, palette: pb } = await loadGridAndPalette(bPath);

  // 统一调色板: 按实际 RGBA 去重, 把两侧体素重映射到同一索引空间, 保证跨文件颜色保真。
  const unified = defaultPalette();
  const colorToCi = new Map();
  let nextCi = 1;
  const ciFor = (col) => {
    const c = col && col.length >= 4 ? col : [128, 128, 128, 255];
    const key = c.join(',');
    const hit = colorToCi.get(key);
    if (hit !== undefined) return hit;
    const ci = nextCi <= 255 ? nextCi++ : 1;
    colorToCi.set(key, ci);
    unified[ci] = c.slice();
    return ci;
  };
  const remap = (g, pal) => {
    const out = new VoxelGrid(g.sx, g.sy, g.sz);
    for (const [k, ci] of g.voxels) out.voxels.set(k, ciFor(pal[ci] || [128, 128, 128, 255]));
    return out;
  };
  const A2 = remap(A, pa);
  const B2 = remap(B, pb);

  const result = voxelCSG(A2, B2, op, { colorTie });
  const bytes = toVoxBytes(result, unified);

  const outPath = output
    ? resolve(output)
    : resolve(basename(aPath, extname(aPath)) + `_${op}_` + basename(bPath));
  writeFileSync(outPath, Buffer.from(bytes));

  return { outputPath: outPath, bytes, count: result.length };
}
