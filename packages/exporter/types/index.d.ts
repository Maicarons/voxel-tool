// 类型声明 —— @voxel-tool/exporter
// 本包以 JS 实现, 此 .d.ts 手写以对外提供类型。
// 复用 @voxel-tool/core 的 RGBA / Material 类型, 保证与 parseVox 返回结构一致。
import type * as THREE from 'three';

/** 调色板单项: [r, g, b, a] (0..255)。与 @voxel-tool/core 的 RGBA 同形, 这里自包含定义,
 *  避免消费端（如 editor）因 package 入口的类型导出解析差异而报 “no exported member”。 */
export type RGBA = [number, number, number, number];

/** MATL 材质 (来自 @voxel-tool/core parseVox, 仅含文件实际存在的字段)。
 *  自包含定义, 不依赖 core 的类型导出。是 core.Material 的结构子集, 因此可直接传入
 *  parseVox 返回的 materials (Record<number, core.Material>)。 */
export interface Material {
  type?: string;
  metalness?: number;
  roughness?: number;
  alpha?: number;
  emissive?: number;
  ior?: number;
}

/** 支持的导出格式 (vox = 无损回写 MagicaVoxel, P3.3) */
export type VoxelFormat = 'glb' | 'gltf' | 'obj' | 'stl' | 'ply' | 'usdz' | 'fbx' | 'vox';

/** 单个体素: 坐标 + 调色板索引 */
export interface Voxel {
  x: number;
  y: number;
  z: number;
  i: number;
}

/** 一个体素模型 (MagicaVoxel 的 SIZE+XYZI) */
export interface VoxelModel {
  size: [number, number, number];
  voxels: Voxel[];
}

/** 多实例场景中的一个实例 (对应 nTRN/nSHP 的世界变换) */
export interface VoxelInstance {
  voxels: Voxel[];
  translation?: [number, number, number];
  rotation?: number;
  hidden?: boolean;
  name?: string;
}

/**
 * 导出输入。三种来源任选其一:
 *  - 解析后的 VOX 结果 `{ models, scene, palette?, materials? }` (来自 @voxel-tool/core parseVox)
 *  - 单模型 `{ model: VoxelModel, palette?, materials? }`
 *  - 显式多实例 `{ instances: VoxelInstance[], palette?, materials? }`
 */
export interface VoxelExportInput {
  models?: VoxelModel[];
  scene?: Array<{ modelIndex: number; translation?: [number, number, number]; rotation?: number; hidden?: boolean; name?: string }>;
  instances?: VoxelInstance[];
  model?: VoxelModel | null;
  /** 256 项 [r,g,b,a] (0..255); 来自 parseVox 时可能为 null, 缺省用 defaultPalette() */
  palette?: number[][] | null;
  materials?: Record<number, Material>;
}

/** 透传给各 exporter 的通用选项 */
export interface ExportOptions {
  /** STL/PLY 是否二进制 (默认 true) */
  binary?: boolean;
  /** 下载时的文件名 (VoxelExporter.download) */
  filename?: string;
  /** Blob 的 MIME (VoxelExporter.toBlob) */
  mime?: string;
  [key: string]: unknown;
}

/** FBX 专属选项 */
export interface FbxOptions extends ExportOptions {
  preset?: 'threejs' | 'unity' | 'unreal' | 'blender' | 'maya';
  axisUp?: 'X' | 'Y' | 'Z' | '-X' | '-Y' | '-Z';
  axisForward?: 'X' | 'Y' | 'Z' | '-X' | '-Y' | '-Z';
  unitScale?: number;
  bakeSpaceTransform?: boolean;
  version?: number;
  includeAnimations?: boolean;
}

export declare const FORMATS: VoxelFormat[];
export declare const DEFAULT_FILENAMES: Record<VoxelFormat, string>;
export declare const MIME_TYPES: Record<VoxelFormat, string>;

export declare function normalizeInput(input: VoxelExportInput): {
  palette: RGBA[];
  materials: Record<number, Material>;
  instances: Required<VoxelInstance>[];
};

/** 构建 y-up 的 THREE.Group (导出对象) */
export declare function buildExportObject(input: VoxelExportInput): THREE.Group;

/** 合并 + 面剔除 + 顶点色(sRGB->linear 已修正) 几何体, 处于 voxel 本地 z-up 空间 */
export declare function buildVoxelGeometry(voxels: Voxel[], palette: RGBA[] | null, opts?: { colorSpace?: 'raw' | 'linear' }): THREE.BufferGeometry;
/** 按材质分桶 */
export declare function buildVoxelBuckets(
  voxels: Voxel[],
  palette: RGBA[] | null,
  materials: Record<number, Material>,
  opts?: { colorSpace?: 'raw' | 'linear' },
): Array<{ geometry: THREE.BufferGeometry; materialId: number }>;
/** 合并 + 面剔除 + 顶点色(sRGB->linear) 的 greedy meshing 变体 (P3.2)。
 *  暴露面多重集与朴素版一致, 仅几何更紧凑。 */
export declare function buildVoxelGeometryGreedy(voxels: Voxel[], palette: RGBA[] | null, opts?: { colorSpace?: 'raw' | 'linear' }): THREE.BufferGeometry;
/** 按材质分桶的 greedy 变体 (P3.2) */
export declare function buildVoxelBucketsGreedy(voxels: Voxel[], palette: RGBA[] | null, materials: Record<number, Material>, opts?: { colorSpace?: 'raw' | 'linear' }): Array<{ geometry: THREE.BufferGeometry; materialId: number }>;
/** 根据材质 id 生成 three 材质 */
export declare function makeMaterial(materialId: number, materials?: Record<number, Material>, opts?: { defaultMaterial?: 'lambert' | 'standard'; side?: THREE.Side }): THREE.Material;
/** 由旋转矩阵 R 与平移构造 z-up 本地空间的 world Matrix4 (共享自 @voxel-tool/mesh) */
export declare function composeWorldMatrix(R: number[], translation?: [number, number, number]): THREE.Matrix4;

/** 多格式导出调度 */
export declare function exportModel(
  object3d: THREE.Object3D,
  format: VoxelFormat,
  options?: ExportOptions,
): Promise<string | ArrayBuffer | Uint8Array | DataView>;

/** 归一化为 Uint8Array (便于 Node 写文件 / 校验魔数) */
export declare function toUint8Array(data: string | ArrayBuffer | Uint8Array | DataView): Uint8Array;
/** 包成 Blob (浏览器下载) */
export declare function toBlob(data: string | ArrayBuffer | Uint8Array | DataView | Blob, mime?: string): Blob;
/** 浏览器端下载 */
export declare function downloadModel(data: string | ArrayBuffer | Uint8Array | DataView | Blob, filename: string, mime?: string): void;

/**
 * 体素导出器: 把 VOX / 体素数据导出为通用 3D 格式。
 */
export declare class VoxelExporter {
  constructor(input: VoxelExportInput);
  /** 构建 (并缓存) y-up 的 THREE.Group */
  build(): THREE.Group;
  /** 导出为指定格式 */
  export(format: VoxelFormat, options?: ExportOptions): Promise<string | ArrayBuffer | Uint8Array | DataView>;
  /** 导出并包成 Blob */
  toBlob(format: VoxelFormat, options?: ExportOptions): Promise<Blob>;
  /** 浏览器端直接下载 */
  download(format: VoxelFormat, options?: ExportOptions): Promise<void>;
}
