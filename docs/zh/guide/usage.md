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

### SolidJS

```tsx
import { VoxViewer } from '@voxel-tool/solid';
import { parseVox } from '@voxel-tool/core';

export function App() {
  const [data, setData] = createSignal(null);
  const onFile = async (e: any) => {
    const buf = new Uint8Array(await e.currentTarget.files[0].arrayBuffer());
    setData(parseVox(buf));
  };
  return (
    <div>
      <input type="file" accept=".vox" onChange={onFile} />
      {data() && <VoxViewer model={data().models[0]} palette={data().palette} />}
    </div>
  );
}
```

### Preact

```jsx
import { VoxViewer } from '@voxel-tool/preact';
import { parseVox } from '@voxel-tool/core';

export function App() {
  const [data, setData] = useState(null);
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

### Svelte 5（runes）

```svelte
<script>
  import { VoxViewer } from '@voxel-tool/svelte';
  import { parseVox } from '@voxel-tool/core';

  let data = $state(null);
  async function onFile(e) {
    const buf = new Uint8Array(await e.currentTarget.files[0].arrayBuffer());
    data = parseVox(buf);
  }
</script>

<input type="file" accept=".vox" onchange={onFile} />
{#if data}
  <VoxViewer model={data.models[0]} palette={data.palette} size={[480, 480]} />
{/if}
```

### Qwik

```tsx
import { component$, useSignal, $ } from '@builder.io/qwik';
import { VoxViewer } from '@voxel-tool/qwik';
import { parseVox } from '@voxel-tool/core';

export const App = component$(() => {
  const data = useSignal(null);
  const onFile = $(async (e: any) => {
    const buf = new Uint8Array(await e.target.files[0].arrayBuffer());
    data.value = parseVox(buf);
  });
  return (
    <div>
      <input type="file" accept=".vox" onchange$={onFile} />
      {data.value && <VoxViewer model={data.value.models[0]} palette={data.value.palette} />}
    </div>
  );
});
```

> Qwik 组件在浏览器可见时才挂载查看器（基于 `useVisibleTask$`），天然契合 Qwik 的「可恢复性」。
> 别忘了在宿主项目的 Vite 配置启用 `@builder.io/qwik/vite` 优化器。

更多属性见 [组件示例](/zh/components/react-viewer)。

## 3. 导出为 3D 格式

`@voxel-tool/exporter` 能把已解析的模型（或原始体素数据）导出为 **GLB / glTF / OBJ / STL / PLY / USDZ / FBX**，并支持写回 **`.vox`** 无损往返。

```js
import { VoxelExporter } from '@voxel-tool/exporter';
import { parseVox } from '@voxel-tool/core';

const { models, palette } = parseVox(bytes);
const exporter = new VoxelExporter({ model: models[0], palette });

// 获取字节（根据格式返回 ArrayBuffer / string / Uint8Array）
const glb = await exporter.export('glb');

// 或在浏览器中直接下载
await exporter.download('fbx', { filename: 'my-model.fbx' });
```

GLB / glTF / PLY / USDZ / FBX 保留顶点色；OBJ 与 STL 仅含几何。完整格式列表与选项见 [导出库 API](/zh/api/exporter)。

### 导出带动画的模型（glTF / GLB 动画）

若 `.vox` 包含 MagicaVoxel 帧动画，传入完整 `parseVox` 结果，导出器会把运动烘焙成 glTF / GLB 里的真实动画片段：

```js
import { VoxelExporter } from '@voxel-tool/exporter';
import { parseVox } from '@voxel-tool/core';

const { models, scene, palette, frameCount } = parseVox(bytes);
const exporter = new VoxelExporter({ models, scene, palette, frameCount });

const glb = await exporter.export('glb');   // 动画已烘焙
```

### 无损往返回 `.vox`

`export('vox')` 把数据（场景图、材质、动画）直接写回 MagicaVoxel `.vox`，无损：

```js
import { VoxelExporter } from '@voxel-tool/exporter';
import { parseVox } from '@voxel-tool/core';

const parsed = parseVox(bytes);
const voxBytes = await new VoxelExporter(parsed).export('vox'); // 重新编码回原始文件

## 4. 无头命令行（CLI）

更喜欢命令行？`@voxel-tool/cli` 包能在没有浏览器的情况下完成上述一切——`.vox` ↔ GLB/glTF/OBJ/STL/PLY/USDZ/FBX 双向转换、网格体素化、导出 Minecraft Schematic，以及布尔 CSG。

```bash
# .vox -> GLB（默认），或其它任意格式
npx @voxel-tool/cli voxel-export model.vox -f glb -o model.glb

# 网格 -> .vox（体素化）
npx @voxel-tool/cli voxel-export model.glb -r 96 -o model.vox

# 对两个体素文件执行布尔 CSG
npx @voxel-tool/cli voxel-csg union a.vox b.vox -o merged.vox
```

完整参数见 [CLI 指南](/zh/guide/cli)。

## 5. Minecraft Schematic

`@voxel-tool/core` 能读写 Sponge v2 `.schem` 文件，因此体素模型可与 Minecraft 模组生态互通：

```js
import { parseSchematic, voxelToSchematic } from '@voxel-tool/core';

const { models, palette } = await parseSchematic(schemBytes);   // .schem -> 可供查看器/导出器使用
const bytes = await voxelToSchematic({ models, palette });       // 模型 -> .schem
```

`parseSchematic` 返回与 `parseVox` 相同的结构，因此可以直接把 `.schem` 喂给 `@voxel-tool/viewer` 或 `@voxel-tool/exporter`。详见 [core API](/zh/api/core)。
```
