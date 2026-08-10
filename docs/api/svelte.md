# @voxel-tool/svelte

Svelte 5 (runes) 3D viewer component (built on `@voxel-tool/viewer` + Three.js). Real 3D cubes + depth buffer + face culling + orthographic isometric camera + OrbitControls.

```js
import { VoxViewer } from '@voxel-tool/svelte';
```

## `<VoxViewer />` Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `src` | `ArrayBuffer \| Uint8Array` | `null` | `.vox` binary; when provided, `parseVox` is called internally |
| `model` | `{ size, voxels }` | `null` | A parsed model (from `parseVox`'s `models[0]`) |
| `palette` | `Array<[r,g,b,a]>` | `null` | A 256-entry palette; pairs with `model` |
| `background` | `string` | `'#16181e'` | Canvas background color |
| `size` | `[number, number]` | `[480, 480]` | Canvas size `[width, height]` (px) |

> Provide either `src` or `model`; if both are given, `model` wins.
> The Svelte version uses a `size` array (like Vue); the other frameworks use separate `width` / `height` props.

## Interaction

- **Left-drag**: rotate the view
- **Scroll**: zoom
- **Right-drag**: pan

The component auto-frames the model (Box3 bounding-box centering + zoom-to-fit) and shows `voxel count · face count` at the bottom-left.

## Example

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
  <VoxViewer model={data.models[0]} palette={data.palette} size={[640, 480]} />
{/if}
```

See [Component Examples · Svelte](/components/svelte-viewer).
