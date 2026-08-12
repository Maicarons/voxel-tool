# @voxel-tool/core

A pure-JS core library: `.vox` read/write, palette helpers, and the `VoxelGrid` voxel container. Runs in Node and the browser — **zero runtime dependencies**.

```js
import {
  VoxelGrid, toVoxBytes, toVoxBytesScene, downloadVox, parseVox,
  defaultPalette, hsvToRgb, rainbowPalette, ROTATION_MATRICES, MAGIC, VERSION,
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
