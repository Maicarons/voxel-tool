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

/** TSL 描边 / 自发光增强选项 (见 applyVoxelTsl) */
export interface TslOptions {
  /** 是否启用 fresnel 边缘描边 (边缘辉光, 近似描边) */
  outline?: boolean;
  /** 描边颜色, 0..1 归一化 RGB (默认黑边 [0,0,0]) */
  outlineColor?: [number, number, number];
  /** fresnel 指数 (默认 3, 越大边缘越锐) */
  outlinePower?: number;
  /** 描边强度 (默认 1) */
  outlineStrength?: number;
  /** 自发光颜色, 0..1 归一化 RGB (默认不启用) */
  emissive?: [number, number, number];
  /** 自发光强度 (默认 1) */
  emissiveIntensity?: number;
}

/** makeMaterial 的选项 */
export interface MaterialOptions {
  /** 默认材质 (materialId=0 或缺失时): 'lambert'(默认, viewer) | 'standard'(exporter) */
  defaultMaterial?: 'lambert' | 'standard';
  /** 渲染面: 默认 THREE.DoubleSide (viewer); exporter 传 THREE.FrontSide */
  side?: THREE.Side;
  /**
   * 传入则创建该 NodeMaterial 子类 (WebGPU / TSL 路径用, 例如 MeshStandardNodeMaterial)。
   * 不传则创建经典 MeshStandardMaterial / MeshLambertMaterial (WebGL 回退路径)。exporter/CLI 永不传此参数。
   */
  nodeMaterialClass?: any;
  /** TSL 描边/自发光增强; 仅对 NodeMaterial 生效, 经典材质降级 */
  tsl?: TslOptions;
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

/**
 * 把描边 / 自发光 TSL 节点挂到材质上 (仅作用于 NodeMaterial; 经典材质降级返回 false)。
 * 详见 TslOptions。
 */
export function applyVoxelTsl(material: any, opts?: TslOptions): boolean;
