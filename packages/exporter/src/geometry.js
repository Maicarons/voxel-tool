// exporter/src/geometry.js —— 兼容转发壳: 体素网格算法已上提到 @voxel-tool/mesh 共享包 (P0 解耦).
// sRGB->linear 顶点色与 Standard/FrontSide 材质差异现通过调用处 opts 表达 (见 build.js)。
// 保留此文件以兼容既有 `import { buildVoxelGeometry } from '@voxel-tool/exporter/src/geometry.js'`。
export {
  buildVoxelGeometry,
  buildVoxelBuckets,
  buildVoxelGeometryGreedy,
  buildVoxelBucketsGreedy,
  makeMaterial,
  composeWorldMatrix,
} from '@voxel-tool/mesh';
