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
| `options.instances` | `Array<Instance>` | `null` | A multi-instance scene (from `parseVox`'s `scene`): each `{ voxels, translation?, rotation?, hidden?, name? }` is placed in world space. Use this instead of `model` for multi-model `.vox` files. |
| `options.palette` | `Array<[r,g,b,a]>` | `null` | A 256-entry palette; pairs with `model` / `instances` |
| `options.materials` | `Record<number, Material>` | `null` | MATL materials (from `parseVox`'s `materials`); voxels whose color index maps to a material render with `MeshStandardMaterial` (metalness / roughness / alpha / emissive) instead of the default `MeshLambertMaterial` |
| `options.background` | `string` | `'#16181e'` | Canvas background color |
| `options.width` | `number` | `480` | Initial width (px) |
| `options.height` | `number` | `480` | Initial height (px) |
| `options.onInfo` | `(info: [number, number] \| null) => void` | `null` | Called after rebuild; argument is `[voxelCount, faceCount]` |

> Provide either `src` / `model` (single model) **or** `instances` (multi-model scene); `instances` takes precedence when both are given.
> Must be called in a browser environment (depends on `window` / WebGL); throws under SSR.

**Return value (controller):**

| Method | Description |
|---|---|
| `update(input?)` | Rebuild the mesh after data changes: `update({ src?, model?, instances?, palette?, materials? })` |
| `setBackground(color)` | Change the canvas background color |
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

## Rendering principle

- Every voxel is a real 3D cube, correctly occluded by the WebGL **depth buffer** (no sorting artifacts for concave shapes or adjacency).
- **Face culling**: only faces exposed to air are generated — a 14582-voxel model measured only 6098 faces.
- **Orthographic isometric camera** `OrthographicCamera` at the `(+,+,+)` angle → the classic MagicaVoxel look.
- `HemisphereLight` + key/fill `DirectionalLight` shade by face normal.
- `OrbitControls` for free rotate / zoom / pan.
- The root `Group` applies a single z-up → y-up rotation; per-instance `translation` / `rotation` come from the scene graph.
