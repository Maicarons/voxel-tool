---
name: voxel-core
description: >-
  This skill should be used when the user wants to read, write, inspect, or
  build MagicaVoxel `.vox` files programmatically in Node (or the browser) —
  without the CLI. It documents the `@voxel-tool/core` API: `parseVox`,
  `toVoxBytes` / `toVoxBytesScene`, the `VoxelGrid` container, palette helpers,
  mesh voxelization, CSG, symmetry, and schematic functions. Trigger phrases
  include "read this .vox in node", "write a .vox from code", "count voxels",
  "build a voxel grid", "voxelize a mesh", "parse voxel file", or any
  script-level `.vox` manipulation.
agent_created: true
---

# voxel-core — 编程式 `.vox` 读写 (Node / 浏览器)

`@voxel-tool/core` is a zero-dependency, pure-JS library for `.vox` read/write
and voxel-grid manipulation. It runs in Node and the browser with no runtime
deps.

## Install / import

```bash
npm i @voxel-tool/core
```
```js
import { parseVox, toVoxBytesScene, VoxelGrid, voxelizeMesh } from '@voxel-tool/core';
```
Inside this repo (after `npm run build -w @voxel-tool/core`), import from the
workspace package `@voxel-tool/core` or the built file
`packages/core/dist/index.js`.

## Read a `.vox`

```js
import { readFile } from 'node:fs/promises';
import { parseVox } from '@voxel-tool/core';

const vox = parseVox(new Uint8Array(await readFile('model.vox')));
// vox = {
//   models:   [{ size: [sx,sy,sz], voxels: [{ x, y, z, i }] }],  // i = palette index (1..255)
//   palette:  number[][],   // 256 x [r,g,b,a]
//   nodes, materials, scene, frameCount
// }
console.log('models:', vox.models.length, 'palette:', vox.palette.length);
console.log('first voxel:', vox.models[0].voxels[0]);
```

## Write a `.vox`

Two writers:

```js
toVoxBytes(grid, palette = null)            // single VoxelGrid -> Uint8Array
toVoxBytesScene({ models, scene, materials }, palette = null)  // full scene -> Uint8Array
```

```js
import { writeFile } from 'node:fs/promises';
import { toVoxBytesScene } from '@voxel-tool/core';

// Lossless round-trip of a parsed file:
const out = toVoxBytesScene({ models: vox.models, scene: vox.scene, materials: vox.materials }, vox.palette);
await writeFile('out.vox', Buffer.from(out));
```

## `VoxelGrid` container

```js
const grid = new VoxelGrid(sx, sy, sz);
grid.set(x, y, z, ci);        // ci = palette index
grid.get(x, y, z);            // palette index or undefined
grid.has(x, y, z);            // boolean
grid.length;                 // voxel count
grid.list();                 // [{ x, y, z, i }]  (or forEach)
grid.addSphere(cx, cy, cz, r, (dx,dy,dz,dist) => ci);  // paint a sphere
grid.clone();
```

Convert a `VoxelGrid` into a model to write it back:

```js
function gridToModel(grid) {
  let sx = 0, sy = 0, sz = 0;
  const voxels = [];
  for (const v of grid.list()) {
    voxels.push({ x: v.x, y: v.y, z: v.z, i: v.i });
    sx = Math.max(sx, v.x + 1); sy = Math.max(sy, v.y + 1); sz = Math.max(sz, v.z + 1);
  }
  return { size: [sx, sy, sz], voxels };
}
```

## More core functions

`voxelizeMesh`, `voxelCSG`, `gridFromMap`, `mirrorCoordinates`,
`parseSchematic`/`voxelToSchematic`, palette helpers
(`defaultPalette`/`hsvToRgb`/`rainbowPalette`), and constants
(`MAGIC`/`VERSION`/`ROTATION_MATRICES`) are all exported. Full signatures,
the complete `VoxelGrid` method list, and `voxelizeMesh` option details live in
**`references/api-reference.md`** — read that when you need exact parameters
(e.g. `voxelizeMesh(triangles, { resolution, mode, pad, color, bounds })`).

## Gotchas

- **Palette indices are 1..255** in MagicaVoxel `.vox`; index `0` is the
  "empty/transparent" sentinel. When assigning colors, index into `vox.palette`
  with the voxel's `i`.
- **`parseVox` takes `Uint8Array` or `ArrayBuffer`.** Wrap `Buffer` from
  `fs.readFile` with `new Uint8Array(...)`.
- **Animation**: `frameCount` and `scene` keyframes are preserved through
  `toVoxBytesScene` for lossless round-trips; per-model voxel edits should keep
  `scene` intact.
- **No I/O in core.** `parseVox` / `toVoxBytes*` only handle bytes — use
  `node:fs` (Node) or `fetch`/download helpers (browser) for files.
