// src/formats.js —— 多格式导出调度 + 字节/Blob 辅助.
//
// 覆盖 7 种格式:
//   glb  -> GLTFExporter (binary)       返回 ArrayBuffer
//   gltf -> GLTFExporter (JSON)         返回 string
//   obj  -> OBJExporter (原生顶点色)     返回 string
//   stl  -> STLExporter (ascii/binary)  返回 string(DataView ascii) / DataView(binary)
//   ply  -> PLYExporter (带顶点色)       返回 string(ASCII) / ArrayBuffer(binary)
//   usdz -> USDZExporter                返回 ArrayBuffer (zip)
//   fbx  -> @comfyorg/fbx-exporter-three 返回 Uint8Array (二进制 FBX)
//
// OBJ/STL/PLY/USDZ/GLTF 全部来自 three 内置 exporter; 只有 FBX 是第三方库。
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { PLYExporter } from 'three/addons/exporters/PLYExporter.js';
import { USDZExporter } from 'three/addons/exporters/USDZExporter.js';
import { FBXExporter } from '@comfyorg/fbx-exporter-three';

/** 全部支持的格式 (含 vox 回写) */
export const FORMATS = ['glb', 'gltf', 'obj', 'stl', 'ply', 'usdz', 'fbx', 'vox'];

/** 各格式默认文件名 */
export const DEFAULT_FILENAMES = {
  glb: 'model.glb',
  gltf: 'model.gltf',
  obj: 'model.obj',
  stl: 'model.stl',
  ply: 'model.ply',
  usdz: 'model.usdz',
  fbx: 'model.fbx',
  vox: 'model.vox',
};

/** 各格式推荐 MIME */
export const MIME_TYPES = {
  glb: 'model/gltf-binary',
  gltf: 'model/gltf+json',
  obj: 'text/plain',
  stl: 'application/octet-stream',
  ply: 'application/octet-stream',
  usdz: 'model/vnd.usdz+zip',
  fbx: 'application/octet-stream',
};

/**
 * 把导出结果按格式导出.
 * @param {THREE.Object3D} object3d 通常是 buildExportObject 返回的 Group
 * @param {string} format 'glb'|'gltf'|'obj'|'stl'|'ply'|'usdz'|'fbx'
 * @param {object} [options] 透传给各 exporter; 通用 { binary?, filename? }; fbx 额外支持 preset/axisUp 等
 * @returns {Promise<string|ArrayBuffer|Uint8Array|DataView>}
 */
export async function exportModel(object3d, format, options = {}) {
  switch (format) {
    case 'glb': {
      const exporter = new GLTFExporter();
      return await new Promise((resolve, reject) => {
        exporter.parse(object3d, (res) => resolve(res), (err) => reject(err), { binary: true, ...options, animations: options.animations || [] });
      });
    }
    case 'gltf': {
      const exporter = new GLTFExporter();
      const res = await new Promise((resolve, reject) => {
        exporter.parse(object3d, (r) => resolve(r), (err) => reject(err), { binary: false, ...options, animations: options.animations || [] });
      });
      // 非 binary 时 onDone 收到的是 JS 对象, 序列化为 .gltf 文本
      return typeof res === 'string' ? res : JSON.stringify(res, null, 2);
    }
    case 'obj': {
      const exporter = new OBJExporter();
      return exporter.parse(object3d); // string
    }
    case 'stl': {
      const exporter = new STLExporter();
      const binary = options.binary !== false; // 默认 binary
      return exporter.parse(object3d, { ...options, binary }); // DataView | string
    }
    case 'ply': {
      const exporter = new PLYExporter();
      const binary = options.binary !== false; // 默认 binary
      return await new Promise((resolve, reject) => {
        exporter.parse(object3d, (res) => resolve(res), { ...options, binary }); // ArrayBuffer | string
      });
    }
    case 'usdz': {
      const exporter = new USDZExporter();
      return await exporter.parseAsync(object3d, options); // ArrayBuffer
    }
    case 'fbx': {
      const exporter = new FBXExporter();
      // vertex-color 体素无纹理, 用同步 parseSync 即可; preset threejs + axisUp Y 对齐 y-up。
      return exporter.parseSync(object3d, { preset: 'threejs', axisUp: 'Y', ...options }); // Uint8Array
    }
    default:
      throw new Error(`不支持的导出格式: ${format}。支持: ${FORMATS.join(', ')}`);
  }
}

/**
 * 把导出结果归一化成 Uint8Array (便于 Node 端写文件 / 校验魔数)。
 * @param {string|ArrayBuffer|Uint8Array|DataView} data
 * @returns {Uint8Array}
 */
export function toUint8Array(data) {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (data instanceof DataView) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  if (typeof data === 'string') return new TextEncoder().encode(data);
  throw new TypeError('toUint8Array: 不支持的数据类型');
}

/**
 * 把导出结果包成 Blob (浏览器下载用)。
 * @param {string|ArrayBuffer|Uint8Array|DataView|Blob} data
 * @param {string} [mime]
 * @returns {Blob}
 */
export function toBlob(data, mime = 'application/octet-stream') {
  if (data instanceof Blob) return data;
  if (typeof data === 'string') return new Blob([data], { type: mime });
  // ArrayBuffer / ArrayBufferView (Uint8Array / DataView) 都可直接入 Blob
  return new Blob([data], { type: mime });
}

/**
 * 浏览器端触发下载。
 * @param {string|ArrayBuffer|Uint8Array|DataView|Blob} data
 * @param {string} filename
 * @param {string} [mime]
 */
export function downloadModel(data, filename, mime) {
  if (typeof document === 'undefined') {
    throw new Error('downloadModel 仅在浏览器环境可用');
  }
  const blob = toBlob(data, mime);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'model.bin';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
