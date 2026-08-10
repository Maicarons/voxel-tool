# Component Example · Vue VoxViewer

A complete, runnable Vue 3 example: it builds a "gray base + rainbow sphere" model on the fly with `@voxel-tool/core`,
runs it through a write → read round-trip, hands it to `VoxViewer` for rendering, and also supports opening a local `.vox` file.

```vue
<!-- App.vue -->
<script setup>
import { ref, computed } from 'vue';
import { VoxViewer } from '@voxel-tool/vue';
import { VoxelGrid, toVoxBytes, parseVox, rainbowPalette } from '@voxel-tool/core';

// Build on the fly: gray base + rainbow sphere -> toVoxBytes -> parseVox
function buildSample(seed = 0) {
  const SIZE = 40;
  const grid = new VoxelGrid(SIZE, SIZE, SIZE + 10);
  for (let x = 0; x < SIZE; x++)
    for (let y = 0; y < SIZE; y++) grid.set(x, y, 0, 200); // index 200 = gray

  const cz = 16 + (seed % 5);
  const r = 18;
  grid.addSphere(20, 20, cz, r, (dx, dy, dz) => {
    const frac = Math.max(0, Math.min(1, (dz + r) / (2 * r)));
    return 1 + Math.round(frac * 253);
  });

  const palette = rainbowPalette();
  return parseVox(toVoxBytes(grid, palette));
}

const seed = ref(0);
const info = ref(buildSample(0));
const fileName = ref('Built-in sample (gray base + rainbow sphere)');
const fileInput = ref(null);

const model = computed(() => info.value.models[0]);

function regenerate() {
  seed.value = (seed.value + 1) % 100;
  info.value = buildSample(seed.value);
  fileName.value = `Built-in sample #${seed.value}`;
}
async function onFile(e) {
  const f = e.target.files?.[0];
  if (!f) return;
  const buf = new Uint8Array(await f.arrayBuffer());
  try {
    info.value = parseVox(buf);
    fileName.value = f.name;
  } catch (err) {
    alert('Parse failed: ' + err.message);
  }
}
</script>

<template>
  <div style="padding:24px;display:flex;flex-direction:column;gap:16px;align-items:flex-start">
    <h1 style="margin:0;font-size:20px">@voxel-tool/vue · Voxel Model Viewer</h1>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <button @click="regenerate">Regenerate</button>
      <button @click="fileInput?.click()">Open .vox file</button>
      <input ref="fileInput" type="file" accept=".vox" style="display:none" @change="onFile" />
      <span>{{ fileName }} · {{ model.voxels.length }} voxels · {{ model.size.join('×') }}</span>
    </div>

    <VoxViewer :model="model" :palette="info.palette" />

    <p style="color:#8b93a7;font-size:13px;max-width:520px;line-height:1.6">
      Left-drag to rotate · scroll to zoom · right-drag to pan. The component uses real 3D rendering from Three.js
      (depth buffer + face culling); you can pass <code>src</code> (raw .vox bytes) or a parsed <code>{ model, palette }</code>.
    </p>
  </div>
</template>
```

## Local preview

```bash
npm run dev:vue   # -> http://localhost:5174
```

Source: [`packages/vue/example/`](https://github.com/Maicarons/voxel-tool/tree/main/packages/vue/example).

## Rendering principle (why it's more robust than Canvas2D)

- Every voxel is a real 3D cube, correctly occluded by the WebGL **depth buffer** (no sorting artifacts for concave shapes or adjacency).
- **Face culling**: only faces exposed to air are generated (6-neighbor check) — a 14582-voxel model measured only 6098 faces.
- **Orthographic isometric camera** `OrthographicCamera` at the `(+,+,+)` angle → the classic MagicaVoxel look.
- `HemisphereLight` + key/fill `DirectionalLight` shade by face normal.
- `OrbitControls` for free rotate / zoom / pan.
