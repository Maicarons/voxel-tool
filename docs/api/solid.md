# @voxel-tool/solid

SolidJS 3D viewer component (built on `@voxel-tool/viewer` + Three.js). Real 3D cubes + depth buffer + face culling + orthographic isometric camera + OrbitControls.

```tsx
import { VoxViewer } from '@voxel-tool/solid';
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

## Interaction

- **Left-drag**: rotate the view
- **Scroll**: zoom
- **Right-drag**: pan

The component auto-frames the model (Box3 bounding-box centering + zoom-to-fit) and shows `voxel count · face count` at the bottom-left.

## Example

```tsx
import { createSignal } from 'solid-js';
import { VoxViewer } from '@voxel-tool/solid';
import { parseVox } from '@voxel-tool/core';

export function App() {
  const [data, setData] = createSignal<any>(null);
  const onFile = async (e: any) => {
    const buf = new Uint8Array(await e.currentTarget.files[0].arrayBuffer());
    setData(parseVox(buf));
  };
  return (
    <div>
      <input type="file" accept=".vox" onChange={onFile} />
      <VoxViewer model={data()?.models[0]} palette={data()?.palette} width={640} height={480} />
    </div>
  );
}
```

See [Component Examples · Solid](/components/solid-viewer).
