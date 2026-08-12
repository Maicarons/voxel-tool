# @voxel-tool/core

纯 JS 核心库：`.vox` 文件读写、调色板工具、`VoxelGrid` 体素容器。Node 与浏览器通用，**零运行时依赖**。

```js
import {
  VoxelGrid, toVoxBytes, toVoxBytesScene, downloadVox, parseVox,
  defaultPalette, hsvToRgb, rainbowPalette, ROTATION_MATRICES, MAGIC, VERSION,
} from '@voxel-tool/core';
```

## `VoxelGrid`

体素容器。内部用 `Map`（key `"x,y,z"` → 颜色索引）存储。

```js
const grid = new VoxelGrid(sx, sy, sz);
```

| 成员 | 说明 |
|---|---|
| `new VoxelGrid(sx, sy, sz)` | 创建尺寸为 `sx × sy × sz` 的网格（越界抛 `RangeError`） |
| `grid.set(x, y, z, ci)` | 设置体素颜色索引 `ci`（0..255）；越界或 `ci` 越界抛错 |
| `grid.addSphere(cx, cy, cz, r, ciFn)` | 在球内填充；`ciFn(dx, dy, dz, dist)` 返回颜色索引 |
| `grid.length` | 体素数量（getter） |
| `grid.list()` | 返回有序数组 `[{ x, y, z, i }]` |
| `grid.voxels` | 底层 `Map`（只读访问） |

## `toVoxBytes(grid, palette)`

```js
const bytes = toVoxBytes(grid, palette); // -> Uint8Array
```

把网格序列化为 `.vox` 二进制（`MAGIC='VOX '` + version 150 + MAIN/SIZE/XYZI/RGBA chunk）。

## `toVoxBytesScene({ models, scene, materials, frameCount }, palette)`

```js
const bytes = toVoxBytesScene({ models, scene, materials, frameCount }, palette); // -> Uint8Array
```

把 **多模型 + 场景图 + 材质 + 动画** 序列化为 `.vox`（与 `parseVox` 的 `scene` / `materials` / `frameCount` 互逆）。写入结构：根 `nGRP` → 每个实例一个 `nTRN` + `nSHP`，外加每个材质一个 `MATL` chunk，动画场景还会写 `FRAM` chunk。

- `models`：与 `parseVox` 的 `models` 同形状。
- `scene`：实例数组（`{ name?, hidden?, translation?, rotation?, modelId, voxels?, frames? }`）。若省略 `voxels`，由 `models[modelId]` 解析。动画实例可带 `frames` 数组（逐帧 `{ translation, rotation }`），会被重新编码为该节点的 `_f` 嵌套字典关键帧（`_t` / `_r` / `_p`，枢轴留原点，因为解算后的变换已包含枢轴）。
- `materials`：`Record<number, Material>`，即 `parseVox` 返回之物。
- `frameCount`：总帧数；`> 1` 时写 `FRAM` chunk 并给动画 `nTRN` 节点补关键帧块。静态场景省略（或传 `1`）。
- `palette`：256 项调色板。

> 与 `parseVox` 无损往返：把 `parseVox` 的结果直接喂回 `toVoxBytesScene(input, palette)`，即可复现原始 `.vox`（场景图、材质、动画全在）。静态实例不带 `frames`，因此写回时不会凭空多出动画数据。

## `parseVox(input)`

```js
const { version, models, palette, scene, frameCount, materials } = parseVox(input);
```

解析 `.vox` 二进制 —— 包括 **场景图**（`nTRN` / `nGRP` / `nSHP`）、**材质**（`MATL`）与 **动画**（`FRAM` + 各节点的 `nTRN` 关键帧）。

- `input`：`Uint8Array` / `ArrayBuffer` / Node `Buffer`。
- 返回：
  - `version: number`
  - `models: Array<{ size: [sx, sy, sz], voxels: Array<{ x, y, z, i }> }>`
  - `palette: Array<[r, g, b, a]> | null`（256 项，`a=0` 表示透明；文件无 RGBA chunk 时为 `null`）
  - `scene: Array<Instance>` —— **始终有值**。旧式单模型文件会自动合成一个 identity 实例。每个实例：
    - `name: string`（节点名，`_name`）
    - `hidden: boolean`（`_hidden`）
    - `translation: [x, y, z]`（体素空间偏移，`_t`）
    - `rotation: number`（0..23 旋转索引，`_r`；对应 `ROTATION_MATRICES` 之一）
    - `modelId: number`（索引到 `models`）
    - `voxels: Array<{ x, y, z, i }>`（由 `models[modelId]` 解析；便于直接渲染）
    - `frames?: Array<{ translation: [x, y, z]; rotation: number }>` —— **逐帧世界变换**。仅动画文件（`frameCount > 1`）才存在。每一项都是该帧已完全解算的世界变换（平移 + 旋转索引，枢轴已预先合成）。可喂给 `@voxel-tool/viewer` 的 `instances[].frames` 做播放，或喂给 `@voxel-tool/exporter` 烘焙 glTF/GLB 动画。
  - `frameCount: number` —— 动画总帧数（来自 `FRAM` chunk；静态文件为 `1`）。
  - `materials: Record<number, Material>` —— 键为 MATL id（1..255）。每个材质只含文件中实际出现的字段（如 `type`、`metalness`、`roughness`、`alpha`、`emissive`、`ior` …），因此解析 → `toVoxBytesScene` 在字段一致时可 **字节级无损往返**。

> **动画**：MagicaVoxel 把运动存为 `FRAM` 总帧数 + 各 `nTRN` 关键帧（`_f` 嵌套字典，含 `_t` 平移 / `_r` 旋转 / `_p` 枢轴字符串）。`parseVox` 会为每实例的每一帧重算已解算的世界变换。静态实例不带 `frames` 字段，因此静态文件往返不会多出任何动画数据。

> 索引映射严格遵循规范：`stream[i]`（i=0..254）→ 调色板索引 `i+1`；`stream[255]` → 索引 `0`。

> 根组统一做 z-up → y-up 变换（`rotateX(-π/2)`）；每个实例的 `translation`/`rotation` 来自场景图。把 `scene` 配合 `@voxel-tool/viewer` 的 `instances` 选项，即可忠实还原 MagicaVoxel 的多模型布局。

## `downloadVox(grid, filename, palette)`

浏览器中触发 `.vox` 文件下载（调用 `toVoxBytes` 后用 Blob 下载）。

## 调色板工具

| 函数 | 返回 |
|---|---|
| `defaultPalette()` | 256 项 `[r,g,b,a]`，MagicaVoxel 默认调色板 |
| `rainbowPalette(baseColor?)` | 256 项；`1..254` 彩虹渐变，`255` 为灰基座（默认 `[130,130,140,255]`） |
| `hsvToRgb(h, s, v)` | `[r,g,b]`（0..255），`h` 为 0..1 |

## 常量

- `MAGIC`：`'VOX '`（4 字节）
- `VERSION`：`150`
- `ROTATION_MATRICES`：`number[][][]`（24 个）—— MagicaVoxel `_r` 索引所用的带符号置换旋转集。`ROTATION_MATRICES[r]` 是 3×3 矩阵；场景实例的 `rotation` 字段即其下标。

## 示例

```js
import { VoxelGrid, toVoxBytes, parseVox, rainbowPalette } from '@voxel-tool/core';

const grid = new VoxelGrid(40, 40, 50);
for (let x = 4; x < 36; x++) for (let y = 4; y < 36; y++) grid.set(x, y, 0, 255);
grid.addSphere(20, 20, 24, 14, (dx, dy, dz) => 1 + Math.round(((dz + 14) / 28) * 253));

const palette = rainbowPalette();
const bytes = toVoxBytes(grid, palette);
const { models } = parseVox(bytes);
console.log(models[0].voxels.length); // 往返一致
```
