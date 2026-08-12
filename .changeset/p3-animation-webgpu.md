---
'@voxel-tool/core': minor
'@voxel-tool/viewer': minor
'@voxel-tool/exporter': minor
'@voxel-tool/react': patch
'@voxel-tool/vue': patch
'@voxel-tool/solid': patch
'@voxel-tool/preact': patch
'@voxel-tool/svelte': patch
'@voxel-tool/qwik': patch
'@voxel-tool/cli': patch
---

P3 动画 + WebGPU:
- core: 解析并写回 MagicaVoxel 动画 (FRAM 总帧数 + nTRN 嵌套 _f 关键帧), 逐帧世界变换, 无损往返, `frameCount`/`frames` 进入类型.
- viewer: 新增播放控制 API (play/pause/stop/setFrame/setLoop/setFrameRate/isPlaying/getFrameCount); 可选 `renderer:'webgpu'` 后端 (不可用时自动回退 WebGL).
- exporter: glTF/GLB 导出时把逐实例逐帧变换烘焙为 `AnimationClip`.
