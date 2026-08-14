# @voxel-tool/core

A pure-JS core library: `.vox` read/write, palette helpers, and the `VoxelGrid` voxel container. Runs in Node and the browser — **zero runtime dependencies**.

```js
import {
  VoxelGrid, toVoxBytes, toVoxBytesScene, downloadVox, parseVox,
  defaultPalette, hsvToRgb, rainbowPalette, ROTATION_MATRICES, MAGIC, VERSION,
  voxelCSG, CSG_OP, mirrorCoordinates, voxelizeMesh,
  parseSchematic, voxelToSchematic, blockColor,
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

## `toVoxBytesScene({ models, scene, materials, frameCount }, palette)`

```js
const bytes = toVoxBytesScene({ models, scene, materials, frameCount }, palette); // -> Uint8Array
```

Serializes **multi-model + scene-graph + materials + animation** `.vox` (the inverse of `parseVox`'s `scene` / `materials` / `frameCount`). Written layout: root `nGRP` → per-instance `nTRN` + `nSHP`, plus one `MATL` chunk per material, and a `FRAM` chunk when the scene is animated.

- `models`: same shape as `parseVox`'s `models`.
- `scene`: array of instances (`{ name?, hidden?, translation?, rotation?, modelId, voxels?, frames? }`). If `voxels` is omitted, it is resolved from `models[modelId]`. Animated instances may carry a `frames` array (per-frame `{ translation, rotation }`) — these are re-encoded as the node's `_f` nested-dict keyframes (`_t` / `_r` / `_p`, pivot left at origin since the resolved transforms already include the pivot).
- `materials`: `Record<number, Material>` as returned by `parseVox`.
- `frameCount`: total frame count; when `> 1` a `FRAM` chunk is emitted and animated `nTRN` nodes get their keyframe block. Omit (or `1`) for static scenes.
- `palette`: 256-entry palette.

> Round-trips losslessly with `parseVox`: feed a `parseVox` result straight back into `toVoxBytesScene(input, palette)` to reproduce the original `.vox` (scene graph, materials, animation, and all). Static instances carry no `frames`, so no spurious animation data is added on write.

## `parseVox(input)`

```js
const { version, models, palette, scene, frameCount, materials } = parseVox(input);
```

Parses `.vox` binary — including the **scene graph** (`nTRN` / `nGRP` / `nSHP`), **materials** (`MATL`), and **animation** (`FRAM` + per-node `nTRN` keyframes).

- `input`: `Uint8Array` / `ArrayBuffer` / Node `Buffer`.
- Returns:
  - `version: number`
  - `models: Array<{ size: [sx, sy, sz], voxels: Array<{ x, y, z, i }> }>`
  - `palette: Array<[r, g, b, a]> | null` (256 entries, `a=0` means transparent; `null` when the file has no RGBA chunk)
  - `scene: Array<Instance>` — **always populated**. For legacy single-model files a single synthetic identity instance is generated automatically. Each instance:
    - `name: string` (node name, `_name`)
    - `hidden: boolean` (`_hidden`)
    - `translation: [x, y, z]` (voxel-space offset, `_t`)
    - `rotation: number` (0..23 rotation index, `_r`; maps to one of `ROTATION_MATRICES`)
    - `modelId: number` (index into `models`)
    - `voxels: Array<{ x, y, z, i }>` (resolved from `models[modelId]`; convenience for rendering)
    - `frames?: Array<{ translation: [x, y, z]; rotation: number }>` — **per-frame world transform**. Present only when the file is animated (`frameCount > 1`). Each entry is the fully-resolved transform for that frame (translation + rotation index), pivots already composed in. Feed this to `@voxel-tool/viewer`'s `instances[].frames` for playback, or to `@voxel-tool/exporter` to bake glTF/GLB animations.
  - `frameCount: number` — total animation frames (from the `FRAM` chunk; `1` for static files).
  - `materials: Record<number, Material>` — keys are MATL ids (1..255). Each material only contains the fields actually present in the file (e.g. `type`, `metalness`, `roughness`, `alpha`, `emissive`, `ior`, …), so a parse → `toVoxBytesScene` round-trip is **byte-identical** when the file uses the same fields.

> **Animation:** MagicaVoxel stores motion as a `FRAM` frame count plus per-`nTRN` keyframes (`_f` nested dict with `_t` translation / `_r` rotation / `_p` pivot strings). `parseVox` recomputes the resolved world transform for every frame of every instance. Static instances keep no `frames` field, so static files round-trip losslessly with zero extra data.

> Index mapping strictly follows the spec: `stream[i]` (i=0..254) → palette index `i+1`; `stream[255]` → index `0`.

> The root group applies a single z-up → y-up transform (`rotateX(-π/2)`); per-instance `translation`/`rotation` come from the scene graph. Combine `scene` with `@voxel-tool/viewer`'s `instances` option to faithfully reproduce MagicaVoxel's multi-model layout.

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
- `ROTATION_MATRICES`: `number[][][]` (24 entries) — the signed-permutation rotation set used by MagicaVoxel's `_r` index. `ROTATION_MATRICES[r]` is a 3×3 matrix; the `rotation` field of a scene instance indexes into it.

## Advanced geometry & interop

### `voxelCSG(A, B, op, options?)`

Boolean CSG over two `VoxelGrid`s. Because voxels live on a discrete integer lattice, boolean operations are exact set operations over coordinate keys — no mesh CSG (BSP / edge-collapse) needed.

```js
import { VoxelGrid, voxelCSG, CSG_OP } from '@voxel-tool/core';

const unionGrid = voxelCSG(a, b, 'union');
const isectGrid = voxelCSG(a, b, 'intersection');
const diffGrid  = voxelCSG(a, b, 'difference'); // a minus b
```

| Param | Type | Description |
|---|---|---|
| `A` | `VoxelGrid` | Primary operand (the minuend for `difference`) |
| `B` | `VoxelGrid` | Secondary operand |
| `op` | `'union' \| 'intersection' \| 'difference'` | Operation (or `CSG_OP.UNION` etc.) |
| `options.colorTie` | `'a' \| 'b'` | Color at conflicting coordinates (default `'a'`) |

The result grid's size is the per-axis maximum of `A` and `B`, so `union` can hold all of `B`. `gridFromMap(map, size)` converts a `{ "x,y,z": colorIndex }` map (e.g. a single editor layer) back into a `VoxelGrid`.

### `mirrorCoordinates(x, y, z, size, symmetry?)`

Pure geometry helper for the **symmetry brush**: given a voxel and the bounding-box `size`, returns every mirrored coordinate across the enabled axes (`{ x?, y?, z? }`). The mirror plane is each axis' geometric center `coord' = (size[a] - 1) - coord[a]`; enabling multiple axes yields all `2^k` flips (de-duplicated). Boundary clipping is left to the caller.

```js
import { mirrorCoordinates } from '@voxel-tool/core';

mirrorCoordinates(2, 3, 4, [10, 10, 10], { x: true }); // -> [[2,3,4], [7,3,4]]
```

### `voxelizeMesh(triangles, options?)`

Voxelize a triangle mesh into a `VoxelGrid`.

```js
import { voxelizeMesh, toVoxBytes } from '@voxel-tool/core';

const { grid, palette } = voxelizeMesh(triangles, { resolution: 64 });
const bytes = toVoxBytes(grid, palette); // -> .vox
```

| Param | Type | Default | Description |
|---|---|---|---|
| `triangles` | `Array<{ a,b,c: [x,y,z], color?: [r,g,b,a] }>` | — | Triangles; `color` is 0..255 per channel (falls back to `options.color`) |
| `options.resolution` | `number \| [nx,ny,nz]` | `64` | Max-dimension voxel resolution (scalar) or explicit `[nx,ny,nz]` |
| `options.mode` | `'shell' \| 'solid'` | `'shell'` | `shell` = surface shell (no closed mesh required); `solid` = fill interior (needs a closed manifold) |
| `options.pad` | `number` | `0` | Voxels to expand the bounding box by |
| `options.color` | `[r,g,b,a]` | `[200,205,215,255]` | Uniform color when a triangle has none |
| `options.bounds` | `[[min],[max]]` | auto | Explicit bounding box |

`shell` uses SAT (13 axes) per triangle/AABB; `solid` casts a `+X` ray per voxel center and counts parity (requires a closed manifold).

### Minecraft Schematic interop

`parseSchematic` / `voxelToSchematic` read and write [Sponge v2](https://spongepowered.org/) `.schem` files (GZip-compressed NBT, zero runtime dependencies — uses the Web-standard `CompressionStream`/`DecompressionStream`, so it works in Node 18+ and the browser). Block placement follows the Sponge spec (`index = x + z*W + y*W*L`), and colors are approximated to the nearest Minecraft block by Euclidean distance (Minecraft has no color semantics).

```js
import { parseSchematic, voxelToSchematic } from '@voxel-tool/core';

// .schem -> voxel data compatible with parseVox (feed straight into the viewer / exporter)
const { models, palette } = await parseSchematic(schemBytes);

// voxel data -> .schem (round-trip with any .vox model)
const schemBytes = await voxelToSchematic({ models, palette }, { name: 'my-build' });
```

| Function | Returns | Description |
|---|---|---|
| `parseSchematic(input)` | `Promise<{ version, models, palette, scene, frameCount, materials }>` | Parses a `.schem` into the same shape as `parseVox` — drop-in for the viewer/exporter |
| `voxelToSchematic(vox, opts?)` | `Promise<Uint8Array>` | Encodes voxel data as a Sponge v2 `.schem` (`opts.name`, `opts.author`, `opts.description`) |
| `blockColor(blockName)` | `[r,g,b,a] \| null` | Returns the representative color of a Minecraft block state (used for the nearest-block heuristic) |

> Legacy MCEdit `.schematic` (numeric ids + YZX raw bytes) is not supported; Sponge v2 is the modern standard.

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
