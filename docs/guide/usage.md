# 使用

## 1. 核心库 `@voxel-tool/core`

### 创建一个模型并写入 `.vox`

```js
import { VoxelGrid, toVoxBytes, rainbowPalette } from '@voxel-tool/core';

const grid = new VoxelGrid(40, 40, 50);

// 灰底座（调色板索引 255 为灰）
for (let x = 4; x < 36; x++)
  for (let y = 4; y < 36; y++)
    for (let z = 0; z < 3; z++) grid.set(x, y, z, 255);

// 彩虹球：由下到上渐变
const R = 14;
grid.addSphere(20, 20, 24, R, (dx, dy, dz) => {
  const frac = Math.max(0, Math.min(1, (dz + R) / (2 * R)));
  return 1 + Math.round(frac * 253);
});

const palette = rainbowPalette();
const bytes = toVoxBytes(grid, palette); // Uint8Array，可直接写入文件或下载
```

### 读取一个 `.vox`

```js
import { parseVox } from '@voxel-tool/core';

// input 可为 Uint8Array / ArrayBuffer / Node Buffer
const { version, models, palette } = parseVox(bytes);
// models: [{ size: [sx, sy, sz], voxels: [{ x, y, z, i }] }]
// palette: 256 项 [r, g, b, a]，索引 0 透明
console.log(models[0].voxels.length, version);
```

### 调色板工具

```js
import { defaultPalette, rainbowPalette, hsvToRgb } from '@voxel-tool/core';

defaultPalette();              // 256 项 [r,g,b,a]，MagicaVoxel 默认调色板
rainbowPalette();              // 1..254 彩虹渐变，255 为灰基座
hsvToRgb(0.3, 0.8, 1.0);       // -> [r,g,b] 0..255
```

### 浏览器中下载 `.vox`

```js
import { downloadVox } from '@voxel-tool/core';
downloadVox(grid, 'my-model.vox', palette); // 触发浏览器下载
```

## 2. 查看器组件

`VoxViewer` 接受两种方式的数据源：

- **`src`**：`.vox` 二进制（`ArrayBuffer` / `Uint8Array`），组件内部调用 `parseVox` 解析。
- **`model` + `palette`**：已解析的模型（来自 `parseVox` 的返回值）。

### React

```jsx
import { VoxViewer } from '@voxel-tool/react';
import { parseVox } from '@voxel-tool/core';

export default function App() {
  const [data] = useState(null);
  const onFile = async (e) => {
    const buf = new Uint8Array(await e.target.files[0].arrayBuffer());
    setData(parseVox(buf));
  };
  return (
    <div>
      <input type="file" accept=".vox" onChange={onFile} />
      {data && <VoxViewer model={data.models[0]} palette={data.palette} />}
    </div>
  );
}
```

### Vue 3

```vue
<script setup>
import { ref } from 'vue';
import { VoxViewer } from '@voxel-tool/vue';
import { parseVox } from '@voxel-tool/core';

const data = ref(null);
async function onFile(e) {
  const buf = new Uint8Array(await e.target.files[0].arrayBuffer());
  data.value = parseVox(buf);
}
</script>

<template>
  <input type="file" accept=".vox" @change="onFile" />
  <VoxViewer v-if="data" :model="data.models[0]" :palette="data.palette" />
</template>
```

更多属性见 [组件示例](/components/react-viewer)。
