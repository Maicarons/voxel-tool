// @voxel-tool/mesh 统一出口: 被 viewer 与 exporter 共用的体素几何算法。
// 体素网格构造 (面剔除 + 顶点色 + greedy meshing) 与实例变换 composeWorldMatrix。
export {
  buildVoxelGeometry,
  buildVoxelBuckets,
  buildVoxelGeometryGreedy,
  buildVoxelBucketsGreedy,
  makeMaterial,
  composeWorldMatrix,
} from './geometry.js';
