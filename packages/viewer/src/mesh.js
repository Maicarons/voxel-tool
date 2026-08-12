// viewer/src/mesh.js —— 兼容转发壳: 体素网格算法已上提到 @voxel-tool/mesh 共享包 (P0 解耦).
// 保留此文件以兼容既有 `import { buildVoxelGeometry } from './mesh.js'` 与框架包 re-export 链路.
export {
  buildVoxelGeometry,
  buildVoxelBuckets,
  buildVoxelGeometryGreedy,
  buildVoxelBucketsGreedy,
  makeMaterial,
  composeWorldMatrix,
} from '@voxel-tool/mesh';
