// Type definitions for @voxel-tool/viewer
// 手维护的 .d.ts (源码为纯 JS). 与 src/index.js / src/viewer.js 的导出保持同步.
import type * as THREE from 'three';
import type { RGBA, Material, Voxel, VoxelModel } from '@voxel-tool/core';

export interface ViewerFrame {
  translation: [number, number, number];
  rotation: number;
}

export interface ViewerInstanceOptions {
  src?: ArrayBuffer | Uint8Array;
  model?: VoxelModel;
  instances?: Array<{
    voxels: Voxel[];
    translation?: [number, number, number];
    rotation?: number;
    hidden?: boolean;
    name?: string;
    /** 逐帧世界变换; 存在即启用动画播放 */
    frames?: ViewerFrame[];
  }>;
  palette?: RGBA[] | null;
  materials?: Record<number, Material>;
  background?: string;
  width?: number;
  height?: number;
  onInfo?: ((info: [number, number] | null) => void) | null;
  /** 渲染后端: 'webgl'(默认) | 'webgpu'(不可用时自动回退 webgl) */
  renderer?: 'webgl' | 'webgpu';
  /** 动画帧率 fps, 默认 12 */
  frameRate?: number;
  /** 动画是否循环, 默认 true */
  loop?: boolean;
  /** 每帧切换回调 */
  onFrame?: ((frame: number) => void) | null;
}

export interface ViewerUpdateInput {
  src?: ArrayBuffer | Uint8Array;
  model?: VoxelModel;
  instances?: ViewerInstanceOptions['instances'];
  palette?: RGBA[] | null;
  materials?: Record<number, Material>;
}

export interface VoxelViewer {
  update(input?: ViewerUpdateInput): void;
  setBackground(color: string): void;
  /** 开始播放动画 (仅当帧数 > 1) */
  play(): void;
  /** 暂停在当前帧 */
  pause(): void;
  /** 停止并回到第 0 帧 */
  stop(): void;
  /** 跳转到指定帧 (并暂停) */
  setFrame(i: number): void;
  /** 设置是否循环 */
  setLoop(b: boolean): void;
  /** 设置帧率 fps */
  setFrameRate(fps: number): void;
  /** 当前是否正在播放 */
  isPlaying(): boolean;
  /** 总帧数 (无动画为 1) */
  getFrameCount(): number;
  dispose(): void;
}

/**
 * 在容器元素内挂载体素 3D 查看器 (框架无关).
 * 需要浏览器环境 + 有效容器元素.
 */
export function createVoxelViewer(
  container: HTMLElement,
  options?: ViewerInstanceOptions,
): VoxelViewer;

/** 构造合并的 BufferGeometry (仅暴露面 + 顶点色), 处于 voxel 本地空间 (z-up) */
export function buildVoxelGeometry(
  voxels: Voxel[],
  palette: RGBA[] | null,
): THREE.BufferGeometry;

/** 按材质分桶: 每个桶一个几何体 + 材质 id (默认桶 id=0) */
export function buildVoxelBuckets(
  voxels: Voxel[],
  palette: RGBA[] | null,
  materials: Record<number, Material> | undefined,
): Array<{ geometry: THREE.BufferGeometry; materialId: number }>;

/** Greedy meshing 变体: 共面同色相邻暴露面合并为最大矩形 (P3.2)。
 *  暴露面多重集与朴素版完全一致, 仅几何更紧凑 (三角面数趋近表面积量级)。 */
export function buildVoxelGeometryGreedy(
  voxels: Voxel[],
  palette: RGBA[] | null,
): THREE.BufferGeometry;

/** 按材质分桶的 greedy 变体 (P3.2) */
export function buildVoxelBucketsGreedy(
  voxels: Voxel[],
  palette: RGBA[] | null,
  materials: Record<number, Material> | undefined,
): Array<{ geometry: THREE.BufferGeometry; materialId: number }>;

/** 根据材质 id 生成 three 材质 (id=0 -> Lambert 顶点色; 否则 Standard) */
export function makeMaterial(
  materialId: number,
  materials: Record<number, Material> | undefined,
): THREE.Material;
