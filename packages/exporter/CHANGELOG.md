# @voxel-tool/exporter

## 0.3.0

### Minor Changes

- ## P3.2: Greedy meshing（贪心网格合并）

  新增 `buildVoxelGeometryGreedy` / `buildVoxelBucketsGreedy`：把共面、同色、相邻的暴露面合并成最大矩形，大幅削减大型体素场景的三角面数（从 O(体素数) 量级降到接近 O(表面积) 量级）。

  - 关键不变量：greedy 变体的「暴露面多重集」与朴素面剔除完全一致，只是几何更紧凑 —— 外观零变化，仅渲染开销更低。
  - 与朴素版共用同一套 `FACES` / `NEIGHBORS` 表与 `present` / `colorOf` 逻辑，保证剔除规则一致（含透明体素视为已占用）。
  - viewer 与 exporter 的构建调用点已默认切换到 greedy 变体；两个包现在也把底层几何函数（`buildVoxelBuckets` / `makeMaterial` / 新的 greedy 函数）从入口真正导出，与 `.d.ts` 声明对齐。
  - exporter 的 `VoxelFormat` 类型补回 `vox`（无损回写 MagicaVoxel，P3.3 已在运行时支持，此前仅是类型缺口）。
