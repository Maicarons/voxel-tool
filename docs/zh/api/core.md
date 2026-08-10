# @voxel-tool/core

纯 JS 核心库：`.vox` 文件读写、调色板工具、`VoxelGrid` 体素容器。Node 与浏览器通用，**零运行时依赖**。

```js
import {
  VoxelGrid, toVoxBytes, downloadVox, parseVox,
  defaultPalette, hsvToRgb, rainbowPalette, MAGIC, VERSION,
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

## `parseVox(input)`

```js
const { version, models, palette } = parseVox(input);
```

解析 `.vox` 二进制。

- `input`：`Uint8Array` / `ArrayBuffer` / Node `Buffer`。
- 返回：
  - `version: number`
  - `models: Array<{ size: [sx, sy, sz], voxels: Array<{ x, y, z, i }> }>`
  - `palette: Array<[r, g, b, a]> | null`（256 项，`a=0` 表示透明；文件无 RGBA chunk 时为 `null`）

> 索引映射严格遵循规范：`stream[i]`（i=0..254）→ 调色板索引 `i+1`；`stream[255]` → 索引 `0`。

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
