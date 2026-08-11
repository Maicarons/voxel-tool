# @voxel-tool/solid

SolidJS 3D viewer component for MagicaVoxel `.vox` voxel models, built on `@voxel-tool/viewer` + Three.js. It uses the same "true 3D" rendering approach as MagicaVoxel.

- Every voxel is a real Three.js 3D cube, correctly occluded by the **WebGL depth buffer**
- **Face culling**: only faces exposed to air are rendered (~6k faces for 14k voxels)
- **Orthographic isometric camera** + `OrbitControls`: left-drag rotate · scroll zoom · right-drag pan
- Accepts `.vox` binary (`ArrayBuffer` / `Uint8Array`), or a pre-parsed `{ model, palette }`

## Install

```bash
npm install @voxel-tool/solid @voxel-tool/core three
# peerDependencies: solid-js
```

## Usage

```jsx
import { VoxViewer } from '@voxel-tool/solid';
import { parseVox } from '@voxel-tool/core';

const buf = await (await fetch('/model.vox')).arrayBuffer();
// <VoxViewer src={buf} />

const info = parseVox(buf);
// <VoxViewer model={info.models[0]} palette={info.palette} />
```

### Props

| Name | Type | Description |
| ---- | ---- | ----------- |
| `src` | `ArrayBuffer \| Uint8Array` | `.vox` binary; choose either `src` or `model` |
| `model` | `{ size:[number,number,number], voxels:[{x,y,z,i}] }` | Pre-parsed model |
| `palette` | `Array<[r,g,b,a]>\|null` (256) | Palette; falls back to gray when `null` |
| `size` | `[number, number]` | Canvas `[width, height]` (px), default `[480, 480]` |
| `background` | `string` | Background color, default `#16181e` |

## Exports

```js
import { VoxViewer, buildVoxelGeometry } from '@voxel-tool/solid';
```

- `VoxViewer`: SolidJS component wrapping the Three.js scene / camera / lights / `OrbitControls` / resource cleanup.
- `buildVoxelGeometry(voxels, palette)`: framework-agnostic pure function returning a `THREE.BufferGeometry` with face culling and vertex colors.
