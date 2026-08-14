# @voxel-tool/viewer

A framework-agnostic Three.js voxel viewer core. Every framework component (React / Vue / Solid / Preact / Svelte / Qwik) reuses this same rendering implementation — **you can also mount the viewer directly in any DOM container, with no UI framework at all**.

```js
import {
  createVoxelViewer, buildVoxelGeometry, buildVoxelBuckets, makeMaterial,
} from '@voxel-tool/viewer';
```

## `createVoxelViewer(container, options)`

Mounts a real-3D voxel viewer inside a container element and returns a controller.

| Param | Type | Default | Description |
|---|---|---|---|
| `container` | `HTMLElement` | — | The target DOM element (must have a width and height) |
| `options.src` | `ArrayBuffer \| Uint8Array` | `null` | `.vox` binary; when provided, `parseVox` is called internally |
| `options.model` | `{ size, voxels }` | `null` | A parsed model (from `parseVox`'s `models[0]`) |
| `options.instances` | `Array<Instance>` | `null` | A multi-instance scene (from `parseVox`'s `scene`): each `{ voxels, translation?, rotation?, hidden?, name?, frames? }` is placed in world space. `frames` is an optional per-frame world transform (`[{ translation, rotation }]`) — when present the viewer enables **animation playback**. Use this instead of `model` for multi-model `.vox` files. |
| `options.palette` | `Array<[r,g,b,a]>` | `null` | A 256-entry palette; pairs with `model` / `instances` |
| `options.materials` | `Record<number, Material>` | `null` | MATL materials (from `parseVox`'s `materials`); voxels whose color index maps to a material render with `MeshStandardMaterial` (metalness / roughness / alpha / emissive) instead of the default `MeshLambertMaterial` |
| `options.background` | `string` | `'#16181e'` | Canvas background color |
| `options.width` | `number` | `480` | Initial width (px) |
| `options.height` | `number` | `480` | Initial height (px) |
| `options.renderer` | `'webgl' \| 'webgpu'` | `'webgpu'` | Rendering backend. Defaults to WebGPU and **falls back to WebGL2 automatically** if the browser/device lacks WebGPU support. Pass `'webgl'` to force the classic path. The WebGPU code is code-split and only downloaded when requested. |
| `options.onBackend` | `(backend: 'webgl' \| 'webgpu') => void` | `null` | Called once the actually-used backend is resolved (after the WebGPU attempt succeeds or falls back). Useful for showing a badge. |
| `options.tsl` | `object \| null` | `null` | TSL outline/emissive enhancement — `{ outline?, outlineColor?, outlinePower?, outlineStrength?, emissive?, emissiveIntensity? }`. Only takes effect on the WebGPU backend; ignored on WebGL. |
| `options.frameRate` | `number` | `12` | Animation playback rate in fps (used when `instances` carry `frames`). |
| `options.loop` | `boolean` | `true` | Whether animation playback loops. |
| `options.onInfo` | `(info: [number, number] \| null) => void` | `null` | Called after rebuild; argument is `[voxelCount, faceCount]` |
| `options.onFrame` | `(frame: number) => void` | `null` | Called on every animation frame change; argument is the current frame index |

> Provide either `src` / `model` (single model) **or** `instances` (multi-model scene); `instances` takes precedence when both are given.
> Must be called in a browser environment (depends on `window` / WebGL); throws under SSR.

**Return value (controller):**

| Method | Description |
|---|---|
| `update(input?)` | Rebuild the mesh after data changes: `update({ src?, model?, instances?, palette?, materials? })` |
| `setBackground(color)` | Change the canvas background color |
| `play()` | Start animation playback (only effective when `frameCount > 1`) |
| `pause()` | Pause playback (keeps the current frame) |
| `stop()` | Stop and rewind to frame 0 |
| `setFrame(i)` | Jump to a specific frame (also pauses) |
| `setLoop(b)` | Toggle looping on/off |
| `setFrameRate(rate)` | Set playback fps |
| `isPlaying()` | `boolean` — whether playback is active |
| `getFrameCount()` | `number` — total frames of the loaded scene (1 for static) |
| `dispose()` | Tear down: cancel animation frames, disconnect the ResizeObserver, release GPU resources |

### Minimal example (no framework, single model)

```js
import { createVoxelViewer } from '@voxel-tool/viewer';
import { parseVox } from '@voxel-tool/core';

const buf = await fetch('/model.vox').then((r) => r.arrayBuffer());
const { models, palette } = parseVox(buf);

const el = document.getElementById('viewer');
const viewer = createVoxelViewer(el, {
  model: models[0],
  palette,
  onInfo: ([voxels, faces]) => console.log(voxels, faces),
});

// Switch model / dispose
// viewer.update({ model: other, palette });
// viewer.dispose();
```

### Multi-model scene (with materials)

```js
import { createVoxelViewer } from '@voxel-tool/viewer';
import { parseVox } from '@voxel-tool/core';

const buf = await fetch('/scene.vox').then((r) => r.arrayBuffer());
const { palette, scene, materials } = parseVox(buf);

const el = document.getElementById('viewer');
const viewer = createVoxelViewer(el, {
  instances: scene,       // each entry already carries voxels / translation / rotation
  palette,
  materials,              // metallic / glass / emissive voxels render correctly
});
```

### Animation playback

When your `instances` carry `frames` (the per-frame world transforms returned by `parseVox` for animated `.vox` files), the viewer exposes a small playback API:

```js
import { createVoxelViewer } from '@voxel-tool/viewer';
import { parseVox } from '@voxel-tool/core';

const buf = await fetch('/anim.vox').then((r) => r.arrayBuffer());
const { palette, scene } = parseVox(buf); // scene instances include `frames` (frameCount > 1)

const viewer = createVoxelViewer(el, {
  instances: scene,
  palette,
  frameRate: 24,   // fps
  loop: true,
  onFrame: (f) => console.log('frame', f),
});

viewer.play();            // start
// viewer.pause();        // hold current frame
// viewer.setFrame(3);    // jump (also pauses)
// viewer.setLoop(false); // play once, then stop
// viewer.stop();         // rewind to 0
// viewer.getFrameCount(); // -> total frames
```

Each animated instance is moved by swapping its local matrix per frame (using its precomputed `frames` transforms), so playback is cheap — no geometry is rebuilt.

### Rendering backend (WebGPU + TSL)

The viewer uses **WebGPU by default** and loads Three's `WebGPURenderer` on demand (`import('three/webgpu')`). If the browser/device lacks WebGPU support it **falls back to WebGL2 automatically** — the default path is fully functional either way, and the WebGPU code is split into its own chunk so it isn't downloaded unless requested.

```js
const viewer = createVoxelViewer(el, {
  model, palette,
  renderer: 'webgpu',            // default; pass 'webgl' to force the classic path
  onBackend: (b) => console.log('active backend:', b),
  tsl: { outline: true, outlineColor: [0, 0, 0], outlinePower: 3, emissive: [0.1, 0.3, 1], emissiveIntensity: 0.6 },
});
```

The `tsl` option adds a **Fresnel rim outline** and/or an **emissive glow** using Three Shading Language nodes (real-time, GPU-side). It only applies on the WebGPU backend; on WebGL the material degrades gracefully to a plain `MeshStandardMaterial` emissive.

## `buildVoxelGeometry(voxels, palette)`

A pure function: compiles a voxel array into a Three.js `BufferGeometry` (with vertex colors and face-culled indices). Geometry is in **voxel-local space**; the viewer applies the global z-up → y-up transform.

| Param | Type | Description |
|---|---|---|
| `voxels` | `Array<{ x, y, z, i }>` | The voxel list |
| `palette` | `Array<[r,g,b,a]>` | A 256-entry palette |

- Face culling: only faces exposed to air are generated (6-neighbor check), trimming 6×N faces down to the shell.
- The resulting geometry's face count is `geo.index.count / 6`, and the triangle count is `/ 3`.

```js
import * as THREE from 'three';
import { buildVoxelGeometry } from '@voxel-tool/viewer';

const geo = buildVoxelGeometry(model.voxels, palette);
const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
```

## `buildVoxelBuckets(voxels, palette, materials?)`

A pure function: groups voxels into buckets by color index (material id). Returns `Array<{ geometry, materialId }>` — one entry per distinct material id. Useful when you want to drive Three.js yourself instead of via `createVoxelViewer`.

| Param | Type | Description |
|---|---|---|
| `voxels` | `Array<{ x, y, z, i }>` | The voxel list |
| `palette` | `Array<[r,g,b,a]>` | A 256-entry palette |
| `materials` | `Record<number, Material>` | Optional MATL map |

```js
import * as THREE from 'three';
import { buildVoxelBuckets, makeMaterial } from '@voxel-tool/viewer';

for (const { geometry, materialId } of buildVoxelBuckets(model.voxels, palette, materials)) {
  const mesh = new THREE.Mesh(geometry, makeMaterial(materialId, materials));
  scene.add(mesh);
}
```

## `makeMaterial(materialId, materials?)`

Returns a Three.js material for a given material id:

- `materialId === 0` (or no entry): `MeshLambertMaterial` (default, vertex-colored).
- otherwise: `MeshStandardMaterial` with `metalness` / `roughness` / `alpha` (→ `transparent` + `opacity`) / `emissive` derived from `materials[materialId]`.

## Greedy meshing (performance)

The viewer builds geometry with **greedy meshing** (in addition to face culling). Coplanar, same-colored, adjacent voxel faces are merged into large quads, collapsing the triangle count by **1–3 orders of magnitude** for solid / slab models — a 48³ solid block drops from 27 648 triangles to **12**, while sparse clouds (few shared faces) barely change. This keeps even very large models rendering instantly.

Two greedy variants of the pure geometry helpers are exported (same signatures as the non-greedy versions):

| Function | Description |
|---|---|
| `buildVoxelGeometryGreedy(voxels, palette)` | Same as `buildVoxelGeometry` but merges coplanar same-color faces into larger quads |
| `buildVoxelBucketsGreedy(voxels, palette, materials?)` | Same as `buildVoxelBuckets` but greedy-merged per bucket |

```js
import * as THREE from 'three';
import { buildVoxelGeometryGreedy } from '@voxel-tool/viewer';

const geo = buildVoxelGeometryGreedy(model.voxels, palette); // far fewer triangles than buildVoxelGeometry
const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
```

> Greedy meshing is on by default inside `createVoxelViewer`; the explicit `*Greedy` functions are for when you drive Three.js yourself.

## Rendering principle

- Every voxel is a real 3D cube, correctly occluded by the WebGL **depth buffer** (no sorting artifacts for concave shapes or adjacency).
- **Face culling + greedy meshing**: only air-exposed faces are kept, then coplanar same-color runs are merged into big quads — a 14582-voxel model measured only 6098 faces, and solid blocks collapse to a handful of triangles.
- **Orthographic isometric camera** `OrthographicCamera` at the `(+,+,+)` angle → the classic MagicaVoxel look.
- `HemisphereLight` + key/fill `DirectionalLight` shade by face normal.
- `OrbitControls` for free rotate / zoom / pan.
- The root `Group` applies a single z-up → y-up rotation; per-instance `translation` / `rotation` come from the scene graph.
