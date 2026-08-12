// @voxel-tool/core VOX 读取层聚合出口.
//
// 历史单文件 reader.js 已按职责拆分为:
//   - rotation.js: ROTATION_MATRICES + 3x3 矩阵运算 (matMul3 / matVec3 / rotationIndex)
//   - parse.ts:    parseVox + 块解析 + MATL 解析
//   - scene.ts:    buildScene 场景图与动画装配
// 这里统一 re-export, 对外 API (parseVox / ROTATION_MATRICES) 完全不变.
export { ROTATION_MATRICES } from './rotation.js';
export { buildScene } from './scene.js';
export { parseVox } from './parse.js';
