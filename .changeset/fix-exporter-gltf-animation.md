---
"@voxel-tool/exporter": patch
---

fix(exporter): glTF/GLB 导出不再丢弃烘焙好的动画

glTF/GLB 分支之前把 `animations: options.animations || []` 传给 GLTFExporter，
用户没显式传 animations 时变成空数组，GLTFExporter 会用它覆盖 object 自带的
`object3d.animations`，导致 buildExportObject 烘焙的 AnimationClip 被丢弃。

改为 `options.animations ?? object3d.animations ?? []`：用户显式传才用用户值，
否则使用烘焙好的动画。CLI 传入 parseVox 结果（含 frames）即可正确导出 glTF 动画。
