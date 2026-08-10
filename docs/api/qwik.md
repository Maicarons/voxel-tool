# @voxel-tool/qwik

Qwik 3D viewer component (built on `@voxel-tool/viewer` + Three.js). Real 3D cubes + depth buffer + face culling + orthographic isometric camera + OrbitControls.

```tsx
import { VoxViewer } from '@voxel-tool/qwik';
```

## `<VoxViewer />` Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `src` | `ArrayBuffer \| Uint8Array` | `null` | `.vox` binary; when provided, `parseVox` is called internally |
| `model` | `{ size, voxels }` | `null` | A parsed model (from `parseVox`'s `models[0]`) |
| `palette` | `Array<[r,g,b,a]>` | `null` | A 256-entry palette; pairs with `model` |
| `background` | `string` | `'#16181e'` | Canvas background color |
| `width` | `number` | `480` | Canvas width (px) |
| `height` | `number` | `480` | Canvas height (px) |

> Provide either `src` or `model`; if both are given, `model` wins.

## Qwik-specific notes

- The component mounts the viewer only when it becomes **visible in the browser** (`useVisibleTask$`), which fits Qwik's resumability model natively.
- It bridges prop changes through `useStore` + `useTask$`; prop changes automatically call `update()` to rebuild the mesh.
- ⚠️ **Your consuming project must enable the `@builder.io/qwik/vite` optimizer in its own Vite config**, otherwise the QRLs exported by this library cannot be resolved.

## Interaction

- **Left-drag**: rotate the view
- **Scroll**: zoom
- **Right-drag**: pan

The component auto-frames the model (Box3 bounding-box centering + zoom-to-fit) and shows `voxel count · face count` at the bottom-left.

## Example

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

See [Component Examples · Qwik](/components/qwik-viewer).
