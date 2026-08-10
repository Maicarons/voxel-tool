# @voxel-tool/react

React 3D viewer component (Three.js). Real 3D cubes + depth buffer + face culling + orthographic isometric camera + OrbitControls.

```jsx
import { VoxViewer } from '@voxel-tool/react';
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

```jsx
import { useEffect, useState } from 'react';
import { VoxViewer } from '@voxel-tool/react';
import { parseVox } from '@voxel-tool/core';

export default function App() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/model.vox')
      .then((r) => r.arrayBuffer())
      .then((buf) => setData(parseVox(buf)));
  }, []);

  if (!data) return <p>Loading…</p>;
  return <VoxViewer model={data.models[0]} palette={data.palette} width={640} height={480} />;
}
```

See [Component Examples · React](/components/react-viewer).
