// Type definitions for @voxel-tool/core
// 手维护的 .d.ts (源码为纯 JS). 与 src/index.js 的导出保持同步.

export type RGBA = [number, number, number, number];

export interface Voxel {
  x: number;
  y: number;
  z: number;
  /** 调色板颜色索引 0..255 (0 表示空/透明) */
  i: number;
}

export interface VoxelModel {
  size: [number, number, number];
  voxels: Voxel[];
}

/** 单个场景实例: 把 models[modelIndex] 摆到世界坐标 */
export interface SceneInstance {
  modelIndex: number;
  translation: [number, number, number];
  /** nTRN _r 旋转索引 (0..23) */
  rotation: number;
  hidden: boolean;
  name: string;
}

/** MATL 块解析结果; 仅 chunk 中实际出现的字段会被包含 */
export interface Material {
  type: string;
  metalness?: number;
  roughness?: number;
  /** 0..1, 1=不透明 */
  alpha?: number;
  /** 0..1 自发光强度 */
  emissive?: number;
  ior?: number;
  flux?: number;
  density?: number;
  specular?: number;
  glow?: number;
}

export interface ParseVoxResult {
  version: number;
  models: VoxelModel[];
  /** 256 项 [r,g,b,a]; 无 RGBA 块时为 null */
  palette: RGBA[] | null;
  /** 始终非空: 老文件自动生成 identity 实例 */
  scene: SceneInstance[];
  /** 索引即调色板颜色索引; 无 MATL 时为 {} */
  materials: Record<number, Material>;
}

export interface SceneData {
  models: VoxelModel[];
  scene?: SceneInstance[];
  materials?: Record<number, Material>;
}

export class VoxelGrid {
  sx: number;
  sy: number;
  sz: number;
  readonly length: number;
  constructor(sx: number, sy: number, sz: number);
  set(x: number, y: number, z: number, ci: number): void;
  addSphere(
    cx: number,
    cy: number,
    cz: number,
    r: number,
    ciFn: (dx: number, dy: number, dz: number, dist: number) => number,
  ): void;
  list(): Voxel[];
}

export function parseVox(input: Uint8Array | ArrayBuffer): ParseVoxResult;

/** 24 个保向符号置换旋转矩阵 (每个 9 元素) */
export const ROTATION_MATRICES: number[][];

/** 单模型 (VoxelGrid) -> .vox 二进制 (向后兼容) */
export function toVoxBytes(grid: VoxelGrid, palette?: RGBA[] | null): Uint8Array;
/** 多模型 + 场景图 + 材质 -> .vox 二进制 (可无损往返) */
export function toVoxBytesScene(data: SceneData, palette?: RGBA[] | null): Uint8Array;
/** 浏览器下载辅助 */
export function downloadVox(grid: VoxelGrid, filename?: string, palette?: RGBA[] | null): void;

export function defaultPalette(): RGBA[];
export function rainbowPalette(): RGBA[];
export function hsvToRgb(h: number, s: number, v: number): [number, number, number];

export const MAGIC: Uint8Array;
export const VERSION: number;
