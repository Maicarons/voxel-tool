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
import { parseVox } from '@voxel-tool/core';
import { VoxelExporter, toUint8Array, FORMATS } from '@voxel-tool/exporter';

export { FORMATS };

/** 返回全部支持的格式数组 */
export function listFormats() {
  return FORMATS;
}

/**
 * 把单个 .vox 文件导出为指定格式并写入磁盘。
 * @param {string} inputPath 输入 .vox 路径
 * @param {object} [opts]
 * @param {string} [opts.format='glb'] 格式: glb|gltf|obj|stl|ply|usdz|fbx
 * @param {string} [opts.output] 输出路径; 省略时取 <输入名去扩展>.<format>
 * @param {boolean} [opts.ascii=false] stl/ply 用 ASCII (默认二进制)
 * @returns {Promise<{ outputPath: string, bytes: Uint8Array }>}
 */
export async function exportVoxFile(inputPath, opts = {}) {
  const { format = 'glb', output, ascii = false } = opts;
  const fmt = String(format).toLowerCase();
  if (!FORMATS.includes(fmt)) {
    throw new Error(`不支持的格式 "${fmt}"。支持: ${FORMATS.join(', ')}`);
  }

  const raw = readFileSync(resolve(inputPath));
  const vox = parseVox(new Uint8Array(raw));

  const exporter = new VoxelExporter(vox);
  const exportOptions = {};
  if (ascii && (fmt === 'stl' || fmt === 'ply')) exportOptions.binary = false;

  const data = await exporter.export(fmt, exportOptions);
  const bytes = toUint8Array(data);

  const outPath = output
    ? resolve(output)
    : resolve(basename(inputPath, extname(inputPath)) + '.' + fmt);
  writeFileSync(outPath, Buffer.from(bytes));

  return { outputPath: outPath, bytes };
}
