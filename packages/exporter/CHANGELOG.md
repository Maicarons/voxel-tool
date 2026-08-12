# @voxel-tool/exporter

## 0.4.1

### Patch Changes

- 3d17eb5: fix(exporter): glTF/GLB 导出不再丢弃烘焙好的动画

  glTF/GLB 分支之前把 `animations: options.animations || []` 传给 GLTFExporter，
  用户没显式传 animations 时变成空数组，GLTFExporter 会用它覆盖 object 自带的
  `object3d.animations`，导致 buildExportObject 烘焙的 AnimationClip 被丢弃。

  改为 `options.animations ?? object3d.animations ?? []`：用户显式传才用用户值，
  否则使用烘焙好的动画。CLI 传入 parseVox 结果（含 frames）即可正确导出 glTF 动画。

## 0.4.0

### Minor Changes

- 98478ea: P3 动画 + WebGPU:
  - core: 解析并写回 MagicaVoxel 动画 (FRAM 总帧数 + nTRN 嵌套 \_f 关键帧), 逐帧世界变换, 无损往返, `frameCount`/`frames` 进入类型.
  - viewer: 新增播放控制 API (play/pause/stop/setFrame/setLoop/setFrameRate/isPlaying/getFrameCount); 可选 `renderer:'webgpu'` 后端 (不可用时自动回退 WebGL).
  - exporter: glTF/GLB 导出时把逐实例逐帧变换烘焙为 `AnimationClip`.

### Patch Changes

- Updated dependencies [98478ea]
  - @voxel-tool/core@0.3.0

## 0.3.0

### Minor Changes

- ## P3.2: Greedy meshing（贪心网格合并）

  新增 `buildVoxelGeometryGreedy` / `buildVoxelBucketsGreedy`：把共面、同色、相邻的暴露面合并成最大矩形，大幅削减大型体素场景的三角面数（从 O(体素数) 量级降到接近 O(表面积) 量级）。

  - 关键不变量：greedy 变体的「暴露面多重集」与朴素面剔除完全一致，只是几何更紧凑 —— 外观零变化，仅渲染开销更低。
  - 与朴素版共用同一套 `FACES` / `NEIGHBORS` 表与 `present` / `colorOf` 逻辑，保证剔除规则一致（含透明体素视为已占用）。
  - viewer 与 exporter 的构建调用点已默认切换到 greedy 变体；两个包现在也把底层几何函数（`buildVoxelBuckets` / `makeMaterial` / 新的 greedy 函数）从入口真正导出，与 `.d.ts` 声明对齐。
  - exporter 的 `VoxelFormat` 类型补回 `vox`（无损回写 MagicaVoxel，P3.3 已在运行时支持，此前仅是类型缺口）。
