# @voxel-tool/exporter

独立的体素模型**导出库**：把体素模型（`.vox` / 原始体素数据）导出为通用 3D 文件格式。底层基于 Three.js 内置导出器 + 第三方 FBX 写入器——**与其他 `@voxel-tool/*` 包并列发布**。

```js
import { VoxelExporter, FORMATS } from '@voxel-tool/exporter';
import { parseVox } from '@voxel-tool/core';

const { models, palette } = parseVox(bytes);
const exporter = new VoxelExporter(models[0]); // 也可传 { models, scene } / { instances }
const glb = await exporter.export('glb');      // ArrayBuffer（可直接下载）
await exporter.download('obj');                // 触发浏览器下载
```

## 支持的格式

| 格式 | 扩展名 | 颜色 | 几何 | 说明 |
|---|---|---|---|---|
| `glb` | `.glb` | 顶点色 | 二进制 glTF | 推荐用于游戏引擎 / Web |
| `gltf` | `.gltf` | 顶点色 | JSON glTF | 文本格式，便于查看 |
| `obj` | `.obj` | **无** | 仅网格 | Three 的 `OBJExporter` 只写几何（不含顶点色） |
| `stl` | `.stl` | **无** | 二进制 | 适合 3D 打印 |
| `ply` | `.ply` | 顶点色 | 二进制 | 对点云友好 |
| `usdz` | `.usdz` | 顶点色 | zip (USD) | Apple 平台 AR |
| `fbx` | `.fbx` | 顶点色 | 二进制 FBX | 经 `@comfyorg/fbx-exporter-three`（已打包） |

> **顶点色**：`glb` / `gltf` / `ply` / `usdz` / `fbx` 均带顶点色。`obj` 与 `stl` 仅含几何——这是底层 Three.js 导出器的限制，并非 bug。

## `VoxelExporter`

高层入口。

```js
const exporter = new VoxelExporter(input);
```

`input` 接受 [输入](#输入) 中的任意形态，会被归一化一次并缓存。

| 方法 | 返回 | 说明 |
|---|---|---|
| `build()` | `THREE.Group` | 构建（并缓存）y-up 的导出对象 |
| `export(format, options?)` | `Promise<string \| ArrayBuffer \| Uint8Array \| DataView>` | 导出为指定格式 |
| `toBlob(format, options?)` | `Promise<Blob>` | 导出并包成 `Blob` |
| `download(format, options?)` | `Promise<void>` | 导出并触发浏览器下载 |

`options` 透传给底层导出器，另有两项辅助：

- `binary`（默认 `true`）——`stl` / `ply` 选择二进制还是 ASCII。
- `filename`——`download` 时的文件名（扩展名按格式自动补全）。

## 底层辅助函数

| 函数 | 说明 |
|---|---|
| `buildExportObject(input)` | 由体素数据构建 y-up 的 `THREE.Group`（与 viewer 同算法，含 sRGB→linear 顶点色修正） |
| `exportModel(object3d, format, options?)` | 对已有的 `THREE.Object3D` 调度某种格式 |
| `toBlob(data, mime?)` | 把任意导出结果归一化为 `Blob` |
| `toUint8Array(data)` | 归一化为 `Uint8Array`（Node 写文件 / 校验魔数） |
| `downloadModel(data, filename, mime?)` | 浏览器下载（非浏览器环境会抛错） |
| `FORMATS` | 所有支持格式的 `string[]` |
| `DEFAULT_FILENAMES` | `Record<format, string>`（如 `{ glb: 'model.glb' }`） |
| `MIME_TYPES` | `Record<format, string>` 推荐 MIME |

## 输入

```ts
interface VoxelExportInput {
  models?: VoxelModel[];
  scene?: Array<{ modelIndex: number; translation?; rotation?; hidden?; name? }>;
  instances?: VoxelInstance[];
  model?: VoxelModel | null;
  palette?: number[][] | null;   // 256 项 [r,g,b,a]；缺省用 defaultPalette()
  materials?: Record<number, Material>;
}
```

三种来源任选其一：

1. **解析后的 VOX** —— 直接来自 `parseVox` 的 `{ models, scene, palette?, materials? }`。
2. **单模型** —— `{ model: { size, voxels }, palette?, materials? }`。
3. **显式多实例** —— `{ instances: [{ voxels, translation?, rotation?, hidden?, name? }], palette?, materials? }`。

`palette` 为 256 项 RGBA；若为 `null`/缺省则用 MagicaVoxel 默认调色板。`materials` 把 MATL id 映射到 PBR 属性，仅在使用材质的 `.vox` 文件时需要。

## 注意事项

- **朝向**：体素数据为 z-up（MagicaVoxel 空间）；根 `Group` 施加 `rotation.x = -π/2`，因此导出模型在 Blender / Unity / Godot 中「立着」。
- **色彩保真**：调色板是 sRGB，而 Three 以线性存储顶点色，故构建几何时做了 sRGB→linear 转换。编辑器/查看器里看到的颜色，导出后一致。
- **FBX** 以 `preset: 'threejs'` + `axisUp: 'Y'` 导出，与其他格式的 y-up 朝向一致。

## 示例：编辑器内导出

内置的**体素编辑器**就用了这个包实现工具栏的「导出模型」——选择格式（GLB / glTF / OBJ / STL / PLY / USDZ / FBX）即可下载当前模型。见 [体素编辑器](/editor)。
