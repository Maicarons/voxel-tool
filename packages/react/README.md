# @voxel-tool/react

React 3D viewer component for MagicaVoxel `.vox` voxel models, built on `@voxel-tool/viewer` + Three.js. It uses the same "true 3D" rendering approach as MagicaVoxel (see threejs-vox-loader / coding.kiwi's *Rendering .vox Files*).

- Every voxel is a real Three.js 3D cube, correctly occluded by the **WebGL depth buffer** (no painter's-algorithm sorting artifacts)
- **Face culling**: only faces exposed to air are rendered (~6k faces for 14k voxels), so even large models rotate smoothly
- **Orthographic isometric camera** + `OrbitControls`: left-drag rotate · scroll zoom · right-drag pan
- Key/fill `DirectionalLight` + `HemisphereLight` shade by face normal
- Accepts `.vox` binary (`ArrayBuffer` / `Uint8Array`), or a pre-parsed `{ model, palette }`

---

## Install

```bash
npm install @voxel-tool/react @voxel-tool/core three
# peerDependencies: react / react-dom (^18 or ^19)
```

---

## Usage

```jsx
import { VoxViewer } from '@voxel-tool/react';
import { parseVox } from '@voxel-tool/core';

// Option 1: pass the .vox binary directly
const buf = await (await fetch('/model.vox')).arrayBuffer();
<VoxViewer src={buf} />

// Option 2: pass a pre-parsed model (recommended, avoids re-parsing)
const info = parseVox(buf);          // { version, models:[{size,voxels}], palette }
<VoxViewer model={info.models[0]} palette={info.palette} />
```

### Props

| Name         | Type                              | Description                                         |
| ------------ | --------------------------------- | --------------------------------------------------- |
| `src`        | `ArrayBuffer \| Uint8Array`       | `.vox` binary; choose either `src` or `model`       |
| `model`      | `{ size:[number,number,number], voxels:[{x,y,z,i}] }` | Pre-parsed model              |
| `palette`    | `Array<[r,g,b,a]>\|null` (256)    | Palette; falls back to gray when `null`             |
| `width`      | `number`                          | Canvas width (px), default `480`                    |
| `height`     | `number`                          | Canvas height (px), default `480`                   |
| `background` | `string`                          | Background color, default `#16181e`                 |

---

## Local demo (no publish needed)

```bash
cd react
npm install        # installs react / vite / three
npm run dev        # starts http://localhost:5173
```

The demo builds a model on the fly (gray base + rainbow sphere → `toVoxBytes` → `parseVox` → render), or load your own model via the "Open .vox file" button.

---

## Headless logic test (no browser)

```bash
npm test           # node test.mjs: verifies buildVoxelGeometry face culling (1 voxel=6 faces, 2x2x2=24, real model << 6x voxels)
```

---

## Build as a library

```bash
npm run build      # Vite bundles to dist (ESM), with react/react-dom/three as externals
```

Exports:

```js
import { VoxViewer, buildVoxelGeometry } from '@voxel-tool/react';
```

- `VoxViewer`: React component wrapping the Three.js scene / camera / lights / `OrbitControls` / resource cleanup.
- `buildVoxelGeometry(voxels, palette)`: framework-agnostic pure function returning a `THREE.BufferGeometry` with face culling and vertex colors (depends only on `three`'s `BufferGeometry`, no WebGL — callable directly in Node for verification).
