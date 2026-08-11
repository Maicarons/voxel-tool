# @voxel-tool/viewer

Framework-agnostic Three.js voxel viewer core: `buildVoxelGeometry` + `createVoxelViewer`. This package is shared by the React / Vue / Solid / Preact / Svelte / Qwik components in this repository, so you normally don't install it directly — use the framework binding instead.

- Every voxel is a real Three.js 3D cube, correctly occluded by the **WebGL depth buffer** (no painter's-algorithm sorting artifacts)
- **Face culling**: only faces exposed to air are generated (~6k faces for 14k voxels), so even large models rotate smoothly
- **Orthographic isometric camera** + `OrbitControls`: left-drag rotate · scroll zoom · right-drag pan
- Key/fill `DirectionalLight` + `HemisphereLight` shade by face normal

## Install

```bash
npm install @voxel-tool/viewer three
```

## Usage

```js
import { createVoxelViewer, buildVoxelGeometry } from '@voxel-tool/viewer';
import { parseVox } from '@voxel-tool/core';

const info = parseVox(arrayBuffer);        // { version, models, palette }
const geom = buildVoxelGeometry(info.models[0].voxels, info.palette);

const viewer = createVoxelViewer({
  container: document.getElementById('app'),
  geometry: geom,
  background: '#16181e',
});
// viewer.dispose() frees GPU resources when you're done
```

## Exports

- `buildVoxelGeometry(voxels, palette)` → `THREE.BufferGeometry` (no WebGL needed; callable directly in Node for verification)
- `createVoxelViewer(options)` → viewer instance with a `dispose()` method
