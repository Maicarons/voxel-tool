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
  /** 逐帧世界变换; 仅动画文件(且本实例确有关键帧)存在 */
  frames?: { translation: [number, number, number]; rotation: number }[];
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
  /** 时间轴总帧数; 无动画文件为 1 */
  frameCount: number;
}

export interface SceneData {
  models: VoxelModel[];
  scene?: SceneInstance[];
  materials?: Record<number, Material>;
  /** 时间轴总帧数; 省略时由 scene 中 frames 的最大长度推断 */
  frameCount?: number;
}

export class VoxelGrid {
  sx: number;
  sy: number;
  sz: number;
  /** 内部体素存储: key "x,y,z" -> 颜色索引 */
  voxels: Map<string, number>;
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

/** 给定 Minecraft block 状态字符串, 返回近似 [r,g,b,a] 颜色 */
export function blockColor(blockName: string): RGBA;

export interface SchematicMeta {
  width: number;
  height: number;
  length: number;
  offset: number[];
  blockNames: string[];
  source: 'sponge-v2';
}

/** Sponge v2 .schem 解析结果 (形状兼容 parseVox, 可直接喂 viewer/exporter) */
export interface ParseSchematicResult {
  version: number;
  dataVersion: number;
  models: VoxelModel[];
  palette: RGBA[] | null;
  scene: SceneInstance[];
  materials: Record<number, Material>;
  frameCount: number;
  schematic: SchematicMeta;
}

/** 解析 Minecraft Sponge v2 Schematic (.schem, GZip+NBT) 为兼容 parseVox 的体素数据 */
export function parseSchematic(input: Uint8Array | ArrayBuffer): Promise<ParseSchematicResult>;
/** 把体素数据写成 Sponge v2 .schem (GZip+NBT), 颜色经最近 block 启发式近似 */
export function voxelToSchematic(vox: unknown, opts?: { fallbackBlock?: string }): Promise<Uint8Array>;

export const MAGIC: Uint8Array;
export const VERSION: number;

/** 单个对称轴开关 */
export interface SymmetryAxes {
  /** 沿 X 轴镜像 (左右) */
  x?: boolean;
  /** 沿 Y 轴镜像 (上下) */
  y?: boolean;
  /** 沿 Z 轴镜像 (前后) */
  z?: boolean;
}

/**
 * 体素镜像坐标工具 (P4.6 对称笔刷核心).
 * 给定坐标与包围盒尺寸, 按开启轴生成所有镜像坐标 (含原点、多轴组合、自动去重).
 * 不做边界裁剪, 越界坐标由消费方过滤.
 */
export function mirrorCoordinates(
  x: number,
  y: number,
  z: number,
  size: [number, number, number],
  symmetry?: SymmetryAxes,
): Array<[number, number, number]>;

/** 一个三角形: 三个顶点 + 可选顶点色 */
export interface Triangle {
  a: [number, number, number];
  b: [number, number, number];
  c: [number, number, number];
  /** 0..255 每通道, 决定该三角形体素着色 (缺省用 VoxelizeOptions.color) */
  color?: [number, number, number, number];
}

export interface VoxelizeOptions {
  /** 网格最大维度分辨率 (标量) 或 [nx,ny,nz] (默认 64) */
  resolution?: number | [number, number, number];
  /** 'shell'=仅表面壳(不需封闭) | 'solid'=填充内部(需封闭流形) (默认 'shell') */
  mode?: 'shell' | 'solid';
  /** 包围盒外扩体素层数 (默认 0) */
  pad?: number;
  /** 统一颜色 (三角形无 color 时, 默认 [200,205,215,255]) */
  color?: [number, number, number, number];
  /** 显式包围盒 [[minx,miny,minz],[maxx,maxy,maxz]] */
  bounds?: [[number, number, number], [number, number, number]];
}

export interface VoxelizeResult {
  grid: VoxelGrid;
  palette: RGBA[];
}

/**
 * 把三角网格体素化 (P4.5).
 * shell 模式用分离轴定理 (SAT) 判定三角面与体素相交, 仅保留表面壳;
 * solid 模式用射线奇偶判定填充内部 (需封闭流形网格).
 */
export function voxelizeMesh(triangles: Triangle[], options?: VoxelizeOptions): VoxelizeResult;

/** 布尔 CSG 运算类型 */
export type CsgOp = 'union' | 'intersection' | 'difference';

/**
 * 体素布尔运算 (P4.6 余下). 对两个 VoxelGrid 做集合运算 (并/交/差), 纯几何无 three 依赖.
 * @param A 主操作数 (差集的被减对象)
 * @param B 次操作数
 * @param op 'union'|'intersection'|'difference'
 * @param options.colorTie 冲突处颜色归属, 默认 'a' (保留 A 的颜色)
 */
export function voxelCSG(A: VoxelGrid, B: VoxelGrid, op: CsgOp, options?: { colorTie?: 'a' | 'b' }): VoxelGrid;

/** 把 "坐标键 -> 颜色索引" Map 规整为 VoxelGrid */
export function gridFromMap(map: Map<string, number>, size: [number, number, number]): VoxelGrid;

/** 支持的布尔运算常量 */
export const CSG_OP: { UNION: 'union'; INTERSECTION: 'intersection'; DIFFERENCE: 'difference' };
