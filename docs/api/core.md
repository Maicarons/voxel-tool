# @voxel-tool/core

A pure-JS core library: `.vox` read/write, palette helpers, and the `VoxelGrid` voxel container. Runs in Node and the browser — **zero runtime dependencies**.

```js
import {
  VoxelGrid, toVoxBytes, downloadVox, parseVox,
  defaultPalette, hsvToRgb, rainbowPalette, MAGIC, VERSION,
} from '@voxel-tool/core';
```

## `VoxelGrid`

A voxel container. Internally stores voxels in a `Map` (key `"x,y,z"` → color index).

```js
const grid = new VoxelGrid(sx, sy, sz);
```

| Member | Description |
|---|---|
| `new VoxelGrid(sx, sy, sz)` | Create a grid of size `sx × sy × sz` (throws `RangeError` if out of range) |
| `grid.set(x, y, z, ci)` | Set the color index `ci` (0..255) of a voxel; throws on out-of-range `x/y/z` or `ci` |
| `grid.addSphere(cx, cy, cz, r, ciFn)` | Fill inside a sphere; `ciFn(dx, dy, dz, dist)` returns the color index |
| `grid.length` | Number of voxels (getter) |
| `grid.list()` | Returns an ordered array `[{ x, y, z, i }]` |
| `grid.voxels` | The underlying `Map` (read-only access) |

## `toVoxBytes(grid, palette)`

```js
const bytes = toVoxBytes(grid, palette); // -> Uint8Array
```

Serializes the grid into `.vox` binary (`MAGIC='VOX '` + version 150 + MAIN/SIZE/XYZI/RGBA chunks).

## `parseVox(input)`

```js
const { version, models, palette } = parseVox(input);
```

Parses `.vox` binary.

- `input`: `Uint8Array` / `ArrayBuffer` / Node `Buffer`.
- Returns:
  - `version: number`
  - `models: Array<{ size: [sx, sy, sz], voxels: Array<{ x, y, z, i }> }>`
  - `palette: Array<[r, g, b, a]> | null` (256 entries, `a=0` means transparent; `null` when the file has no RGBA chunk)

> Index mapping strictly follows the spec: `stream[i]` (i=0..254) → palette index `i+1`; `stream[255]` → index `0`.

## `downloadVox(grid, filename, palette)`

Triggers a `.vox` file download in the browser (calls `toVoxBytes` then downloads via a Blob).

## Palette helpers

| Function | Returns |
|---|---|
| `defaultPalette()` | 256 entries `[r,g,b,a]`, the MagicaVoxel default palette |
| `rainbowPalette(baseColor?)` | 256 entries; rainbow gradient on `1..254`, `255` is the gray base (default `[130,130,140,255]`) |
| `hsvToRgb(h, s, v)` | `[r,g,b]` (0..255), `h` is 0..1 |

## Constants

- `MAGIC`: `'VOX '` (4 bytes)
- `VERSION`: `150`

## Example

```js
import { VoxelGrid, toVoxBytes, parseVox, rainbowPalette } from '@voxel-tool/core';

const grid = new VoxelGrid(40, 40, 50);
for (let x = 4; x < 36; x++) for (let y = 4; y < 36; y++) grid.set(x, y, 0, 255);
grid.addSphere(20, 20, 24, 14, (dx, dy, dz) => 1 + Math.round(((dz + 14) / 28) * 253));

const palette = rainbowPalette();
const bytes = toVoxBytes(grid, palette);
const { models } = parseVox(bytes);
console.log(models[0].voxels.length); // round-trip consistent
```
