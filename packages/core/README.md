# @voxel-tool/core

Dependency-free MagicaVoxel `.vox` read/write, palette, and `VoxelGrid` core library for Node and the browser. This is the shared foundation for `@voxel-tool/react`, `@voxel-tool/vue`, and the other framework bindings.

## Capabilities

| Export | Description |
|---|---|
| `VoxelGrid` | Voxel container: `set(x,y,z,ci)`, `addSphere(...)`, `list()` |
| `toVoxBytes(grid, palette?)` | Pack into a `Uint8Array` (write to file / upload / download) |
| `downloadVox(grid, name, palette?)` | Trigger a `.vox` download in the browser |
| `parseVox(arrayBuffer \| Uint8Array)` | Parse into `{ version, models, palette }` |
| `rainbowPalette()` / `defaultPalette()` / `hsvToRgb()` | Palette helpers |

## In Node

```js
import { writeFileSync, readFileSync } from 'node:fs';
import { VoxelGrid, toVoxBytes, parseVox, rainbowPalette } from '@voxel-tool/core';

const g = new VoxelGrid(10, 10, 10);
for (let x = 0; x < 10; x++)
  for (let y = 0; y < 10; y++)
    for (let z = 0; z < 10; z++)
      g.set(x, y, z, 1 + (x + y + z) % 200);

writeFileSync('cube.vox', toVoxBytes(g));            // default palette
const info = parseVox(readFileSync('cube.vox'));
console.log(info.models[0].voxels.length);            // 1000
```

Verify with `node test.mjs` (write → read round-trip + palette consistency).

## In the browser

```js
import { VoxelGrid, downloadVox, rainbowPalette } from '@voxel-tool/core';
const g = new VoxelGrid(8, 8, 8);
/* ... fill ... */
downloadVox(g, 'my.vox', rainbowPalette());   // browser download
```

> With Vite / a bundler, `import { parseVox } from '@voxel-tool/core'` is all you need; you can also import the package's `src/index.js` directly.
