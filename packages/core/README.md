# 📦 `@vox/base` —— VOX 基底功能包 (纯 JS)

Node 与浏览器通用的 .vox 读写 / 调色板 / `VoxelGrid`，是 `@vox/react`、`@vox/vue` 的可复用底座。

## 能力

| 导出 | 说明 |
|---|---|
| `VoxelGrid` | 体素容器：`set(x,y,z,ci)`、`addSphere(...)`、`list()` |
| `toVoxBytes(grid, palette?)` | 打包成 `Uint8Array`（写入文件 / 上传 / 下载） |
| `downloadVox(grid, name, palette?)` | 浏览器端直接下载 .vox |
| `parseVox(arrayBuffer \| Uint8Array)` | 解析为 `{ version, models, palette }` |
| `rainbowPalette()` / `defaultPalette()` / `hsvToRgb()` | 调色板工具 |

## 在 Node 里用

```js
import { writeFileSync, readFileSync } from 'node:fs';
import { VoxelGrid, toVoxBytes, parseVox, rainbowPalette } from '@vox/base';

const g = new VoxelGrid(10, 10, 10);
for (let x = 0; x < 10; x++)
  for (let y = 0; y < 10; y++)
    for (let z = 0; z < 10; z++)
      g.set(x, y, z, 1 + (x + y + z) % 200);

writeFileSync('cube.vox', toVoxBytes(g));            // 默认调色板
const info = parseVox(readFileSync('cube.vox'));
console.log(info.models[0].voxels.length);            // 1000
```

验证：`node test.mjs`（写回读回一致 + 调色板一致）。

## 在浏览器里用

```js
import { VoxelGrid, downloadVox, rainbowPalette } from '@vox/base';
const g = new VoxelGrid(8, 8, 8);
/* ... 填充 ... */
downloadVox(g, 'my.vox', rainbowPalette());   // 浏览器直接下载
```

> Vite / 打包器里 `import { parseVox } from '@vox/base'` 即可；也可直接 `import` 本包 `src/index.js`。
