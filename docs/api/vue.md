# @voxel-tool/vue

Vue 3 3D viewer component (Three.js). Same rendering approach as `@voxel-tool/react`.

```js
import { VoxViewer } from '@voxel-tool/vue';
```

## `<VoxViewer />` Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `src` | `ArrayBuffer \| Uint8Array` | `null` | `.vox` binary; when provided, `parseVox` is called internally |
| `model` | `Object` | `null` | A parsed model (from `parseVox`'s `models[0]`) |
| `palette` | `Array` | `null` | A 256-entry palette; pairs with `model` |
| `background` | `String` | `'#16181e'` | Canvas background color |
| `size` | `Array` | `[480, 480]` | Canvas size `[width, height]` (px) |

> Provide either `src` or `model`; if both are given, `model` wins.

## Interaction

- **Left-drag**: rotate the view
- **Scroll**: zoom
- **Right-drag**: pan

The component auto-frames the model (Box3 bounding-box centering + zoom-to-fit) and shows `voxel count · face count` at the bottom-left.

## Example

```vue
<script setup>
import { ref, onMounted } from 'vue';
import { VoxViewer } from '@voxel-tool/vue';
import { parseVox } from '@voxel-tool/core';

const data = ref(null);
onMounted(async () => {
  const buf = await fetch('/model.vox').then((r) => r.arrayBuffer());
  data.value = parseVox(buf);
});
</script>

<template>
  <VoxViewer v-if="data" :model="data.models[0]" :palette="data.palette" :size="[640, 480]" />
</template>
```

See [Component Examples · Vue](/components/vue-viewer).
