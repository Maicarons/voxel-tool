# @voxel-tool/cli

## 0.1.2

### Patch Changes

- 98478ea: P3 动画 + WebGPU:
  - core: 解析并写回 MagicaVoxel 动画 (FRAM 总帧数 + nTRN 嵌套 \_f 关键帧), 逐帧世界变换, 无损往返, `frameCount`/`frames` 进入类型.
  - viewer: 新增播放控制 API (play/pause/stop/setFrame/setLoop/setFrameRate/isPlaying/getFrameCount); 可选 `renderer:'webgpu'` 后端 (不可用时自动回退 WebGL).
  - exporter: glTF/GLB 导出时把逐实例逐帧变换烘焙为 `AnimationClip`.
- Updated dependencies [98478ea]
  - @voxel-tool/core@0.3.0
  - @voxel-tool/exporter@0.4.0

## 0.1.1

### Patch Changes

- Updated dependencies
  - @voxel-tool/exporter@0.3.0
