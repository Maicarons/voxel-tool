# Usage

## 1. Core library `@voxel-tool/core`

### Create a model and write it to `.vox`

```js
import { VoxelGrid, toVoxBytes, rainbowPalette } from '@voxel-tool/core';

const grid = new VoxelGrid(40, 40, 50);

// Gray base (palette index 255 is gray)
for (let x = 4; x < 36; x++)
  for (let y = 4; y < 36; y++)
    for (let z = 0; z < 3; z++) grid.set(x, y, z, 255);

// Rainbow sphere: gradient from bottom to top
const R = 14;
grid.addSphere(20, 20, 24, R, (dx, dy, dz) => {
  const frac = Math.max(0, Math.min(1, (dz + R) / (2 * R)));
  return 1 + Math.round(frac * 253);
});

const palette = rainbowPalette();
const bytes = toVoxBytes(grid, palette); // Uint8Array, ready to write to disk or download
```

### Read a `.vox`

```js
import { parseVox } from '@voxel-tool/core';

// input can be Uint8Array / ArrayBuffer / Node Buffer
const { version, models, palette } = parseVox(bytes);
// models: [{ size: [sx, sy, sz], voxels: [{ x, y, z, i }] }]
// palette: 256 entries [r, g, b, a], index 0 is transparent
console.log(models[0].voxels.length, version);
```

### Palette helpers

```js
import { defaultPalette, rainbowPalette, hsvToRgb } from '@voxel-tool/core';

defaultPalette();              // 256 entries [r,g,b,a], the MagicaVoxel default palette
rainbowPalette();              // rainbow gradient on 1..254, 255 is the gray base
hsvToRgb(0.3, 0.8, 1.0);       // -> [r,g,b] 0..255
```

### Download a `.vox` in the browser

```js
import { downloadVox } from '@voxel-tool/core';
downloadVox(grid, 'my-model.vox', palette); // triggers a browser download
```

## 2. Viewer components

`VoxViewer` accepts the model in two ways:

- **`src`**: `.vox` binary (`ArrayBuffer` / `Uint8Array`); the component calls `parseVox` internally.
- **`model` + `palette`**: an already-parsed model (the return value of `parseVox`).

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

### Svelte 5 (runes)

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

> The Qwik component mounts the viewer only when it becomes visible in the browser (`useVisibleTask$`), which fits Qwik's resumability model natively.
> Don't forget to enable the `@builder.io/qwik/vite` optimizer in your host project's Vite config.

See [Component Examples](/components/react-viewer) for more props.

## 3. Export to 3D formats

`@voxel-tool/exporter` turns a parsed model — or raw voxel data — into **GLB / glTF / OBJ / STL / PLY / USDZ / FBX**.

```js
import { VoxelExporter } from '@voxel-tool/exporter';
import { parseVox } from '@voxel-tool/core';

const { models, palette } = parseVox(bytes);
const exporter = new VoxelExporter({ model: models[0], palette });

// Get the bytes (ArrayBuffer / string / Uint8Array depending on format)
const glb = await exporter.export('glb');

// Or download directly in the browser
await exporter.download('fbx', { filename: 'my-model.fbx' });
```

GLB / glTF / PLY / USDZ / FBX preserve vertex colors; OBJ and STL carry geometry only. See the [Exporter API](/api/exporter) for the full format list and options.
