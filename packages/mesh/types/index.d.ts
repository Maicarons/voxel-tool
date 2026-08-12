// Type definitions for @voxel-tool/mesh
// 手维护的 .d.ts (源码为纯 JS). 与 src/index.js / src/geometry.js 的导出保持同步.
import type * as THREE from 'three';
import type { RGBA, Material, Voxel } from '@voxel-tool/core';

/** 顶点色色彩空间: 'raw'(默认, 渲染侧自理) | 'linear'(sRGB->linear 修正, 导出 WYSIWYG) */
export type ColorSpace = 'raw' | 'linear';

/** buildVoxel* / *Greedy 的通用选项 */
export interface BuildOptions {
  colorSpace?: ColorSpace;
}

/** makeMaterial 的选项 */
export interface MaterialOptions {
  /** 默认材质 (materialId=0 或缺失时): 'lambert'(默认, viewer) | 'standard'(exporter) */
  defaultMaterial?: 'lambert' | 'standard';
  /** 渲染面: 默认 THREE.DoubleSide (viewer); exporter 传 THREE.FrontSide */
  side?: THREE.Side;
}

/** 构造合并的 BufferGeometry (仅暴露面 + 顶点色), 处于 voxel 本地空间 (z-up) */
export function buildVoxelGeometry(voxels: Voxel[], palette: RGBA[] | null, opts?: BuildOptions): THREE.BufferGeometry;

/** 按材质分桶: 每个桶一个几何体 + 材质 id (默认桶 id=0) */
export function buildVoxelBuckets(voxels: Voxel[], palette: RGBA[] | null, materials: Record<number, Material> | undefined, opts?: BuildOptions): Array<{ geometry: THREE.BufferGeometry; materialId: number }>;

/** Greedy meshing 变体 (P3.2): 暴露面多重集与朴素版一致, 仅几何更紧凑 */
export function buildVoxelGeometryGreedy(voxels: Voxel[], palette: RGBA[] | null, opts?: BuildOptions): THREE.BufferGeometry;

/** 按材质分桶的 greedy 变体 (P3.2) */
export function buildVoxelBucketsGreedy(voxels: Voxel[], palette: RGBA[] | null, materials: Record<number, Material> | undefined, opts?: BuildOptions): Array<{ geometry: THREE.BufferGeometry; materialId: number }>;

/** 根据材质 id 生成 three 材质 (id=0/缺失 -> 默认材质; 否则 Standard) */
export function makeMaterial(materialId: number, materials?: Record<number, Material>, opts?: MaterialOptions): THREE.Material;

/** 由旋转矩阵 R (9 元素行主序) 与平移构造 z-up 本地空间的 world Matrix4 */
export function composeWorldMatrix(R: number[], translation?: [number, number, number]): THREE.Matrix4;
