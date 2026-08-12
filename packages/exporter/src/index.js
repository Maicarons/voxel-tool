// src/index.js —— @voxel-tool/exporter 公共出口.
//
// 用法:
//   import { VoxelExporter, buildExportObject, exportModel } from '@voxel-tool/exporter';
//
//   // 1) 直接给解析后的 VOX → 导出 GLB
//   const vox = parseVox(bytes);                 // @voxel-tool/core
//   const exporter = new VoxelExporter(vox);
//   const glb = await exporter.export('glb');    // ArrayBuffer
//   await exporter.download('obj');              // 浏览器下载 model.obj
//
//   // 2) 纯数据 (无需 core): 多实例 + 调色板
//   const obj = buildExportObject({ instances, palette, materials });
//   const bytes = await exportModel(obj, 'fbx'); // Uint8Array
import { toVoxBytesScene } from '@voxel-tool/core';
import { buildExportObject, normalizeInput } from './build.js';
import {
  exportModel,
  toBlob,
  toUint8Array,
  downloadModel,
  FORMATS,
  DEFAULT_FILENAMES,
  MIME_TYPES,
} from './formats.js';

export {
  buildExportObject,
  normalizeInput,
  exportModel,
  toBlob,
  toUint8Array,
  downloadModel,
  FORMATS,
  DEFAULT_FILENAMES,
  MIME_TYPES,
};

// 低层几何构建 (与 viewer 同算法, 带 sRGB->linear 修正)
export { buildVoxelGeometry, buildVoxelBuckets, makeMaterial } from './geometry.js';

/**
 * 体素导出器: 把 VOX / 体素数据导出为通用 3D 格式。
 */
export class VoxelExporter {
  /**
   * @param {object} input VOX 解析结果 / { model } / { instances } 之一, 可带 palette/materials
   */
  constructor(input) {
    this.input = input;
    /** @private 缓存构建好的导出对象 */
    this._object = null;
  }

  /** 构建 (并缓存) y-up 的 THREE.Group */
  build() {
    if (!this._object) this._object = buildExportObject(this.input);
    return this._object;
  }

  /**
   * 导出为指定格式。
   * @param {string} format 'glb'|'gltf'|'obj'|'stl'|'ply'|'usdz'|'fbx'
   * @param {object} [options] 透传各 exporter + { binary?, filename? }
   * @returns {Promise<string|ArrayBuffer|Uint8Array|DataView>}
   */
  export(format, options = {}) {
    if (format === 'vox') return this.exportVox(options);
    const object = this.build();
    return exportModel(object, format, options);
  }

  /**
   * 把体素数据无损写回 MagicaVoxel .vox 二进制 (round-trip)。
   * - 若输入是 parseVox 结果 (含 models + scene)，直接原样回写 (保留材质/变换/隐藏)。
   * - 否则把归一化后的实例反推成 { models, scene } 再写 (每个实例成为一个模型)。
   * @param {object} [_options]
   * @returns {Promise<Uint8Array>}
   */
  exportVox(_options = {}) {
    const input = this.input;
    // 路径 A: parseVox 结果 -> 直接无损往返
    if (input && Array.isArray(input.models) && Array.isArray(input.scene)) {
      return Promise.resolve(toVoxBytesScene(input, input.palette || null));
    }
    // 路径 B: { model } / { instances } -> 反推 models + scene
    const { palette, materials, instances } = normalizeInput(input);
    const models = instances.map((inst) => {
      let sx = 0, sy = 0, sz = 0;
      for (const v of inst.voxels) {
        if (v.x + 1 > sx) sx = v.x + 1;
        if (v.y + 1 > sy) sy = v.y + 1;
        if (v.z + 1 > sz) sz = v.z + 1;
      }
      return { size: [sx, sy, sz], voxels: inst.voxels };
    });
    const scene = instances.map((inst, i) => ({
      modelIndex: i,
      translation: inst.translation || [0, 0, 0],
      rotation: inst.rotation || 0,
      hidden: !!inst.hidden,
      name: inst.name || '',
    }));
    return Promise.resolve(toVoxBytesScene({ models, scene, materials }, palette));
  }

  /**
   * 导出并包成 Blob。
   * @param {string} format
   * @param {object} [options]
   * @returns {Promise<Blob>}
   */
  toBlob(format, options = {}) {
    const mime = (options && options.mime) || MIME_TYPES[format] || 'application/octet-stream';
    return this.export(format, options).then((data) => toBlob(data, mime));
  }

  /**
   * 浏览器端直接下载。
   * @param {string} format
   * @param {object} [options]
   * @returns {Promise<void>}
   */
  download(format, options = {}) {
    const filename = (options && options.filename) || DEFAULT_FILENAMES[format] || 'model.bin';
    const mime = MIME_TYPES[format] || 'application/octet-stream';
    return this.export(format, options).then((data) => downloadModel(data, filename, mime));
  }
}
