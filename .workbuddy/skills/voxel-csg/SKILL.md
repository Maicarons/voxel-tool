---
name: voxel-csg
description: >-
  This skill should be used when the user wants to perform a boolean
  constructive-solid-geometry operation on voxel models: union (merge),
  intersection (overlap), or difference (subtract / carve a hole). It covers
  both the headless `voxel-csg` CLI and the programmatic `voxelCSG` /
  `gridFromMap` API from `@voxel-tool/core`. Trigger phrases include "merge two
  .vox", "subtract b from a", "carve a hole in the voxel model", "intersect
  these voxels", or any request to combine or cut voxel models.
agent_created: true
---

# voxel-csg — 体素布尔运算 (并 / 交 / 差)

Combine or cut voxel models with a boolean CSG operation. Works on `.vox` (or
`.schem`) files headlessly, or programmatically on `VoxelGrid` instances.

## When to use

- **Union** — merge two voxel models into one (e.g. assemble parts).
- **Intersection** — keep only the overlapping voxels of two models.
- **Difference** — subtract one model from another (carve a hole / cut).
- Programmatic CSG inside a Node script on `VoxelGrid` objects.

## Method A — CLI `voxel-csg`

Run from the repo root (no install) or via npx / global install:

```bash
node packages/cli/bin/voxel-csg.mjs <op> <a.vox> <b.vox> [options]
# or: npx @voxel-tool/cli voxel-csg <op> <a.vox> <b.vox> [options]
```

### Arguments

| Position | Meaning |
|----------|---------|
| `<op>`   | `union` \| `intersection` \| `difference` (difference = `a` minus `b`) |
| `<a.vox>`| Primary operand (`.vox` / `.schem`) |
| `<b.vox>`| Secondary operand (`.vox` / `.schem`) |

### Options

| Flag | Alias | Effect |
|------|-------|--------|
| `-o, --output <path>` | | Output `.vox` path. Default `<a>_<op>_<b>.vox`. |
| `--tie <a|b>` | | Color ownership at conflicting voxels. Default `a` (keep primary color). |
| `-h, --help` | | Print help. |

### Examples

```bash
# Merge a + b
node packages/cli/bin/voxel-csg.mjs union a.vox b.vox -o merged.vox

# Carve b out of a (hole effect)
node packages/cli/bin/voxel-csg.mjs difference a.vox b.vox

# Keep only the overlap of a and b
node packages/cli/bin/voxel-csg.mjs intersection a.vox b.vox

# Use b's color where voxels conflict
node packages/cli/bin/voxel-csg.mjs union a.vox b.vox --tie b
```

## Method B — Programmatic API (Node)

`voxelCSG` and `gridFromMap` live in `@voxel-tool/core`:

```js
import { parseVox, toVoxBytesScene, VoxelGrid, voxelCSG, gridFromMap } from '@voxel-tool/core';
import { readFile, writeFile } from 'node:fs/promises';

// From two .vox files
const a = parseVox(new Uint8Array(await readFile('a.vox')));
const b = parseVox(new Uint8Array(await readFile('b.vox')));

// Build VoxelGrid operands from each model (first model shown)
const ga = gridFromMap(voxelsToMap(a.models[0].voxels), a.models[0].size);
const gb = gridFromMap(voxelsToMap(b.models[0].voxels), b.models[0].size);

const result = voxelCSG(ga, gb, 'union', { colorTie: 'a' });
console.log('voxel count:', result.length);

// result is a VoxelGrid — write back to .vox via toVoxBytesScene
// (convert grid -> model first; see voxel-core skill for the helper)
```

### Signatures

```ts
voxelCSG(A: VoxelGrid, B: VoxelGrid, op: 'union'|'intersection'|'difference', options?: { colorTie?: 'a'|'b' }): VoxelGrid
gridFromMap(map: Map<string, number>, size: [number, number, number]): VoxelGrid
```

`CSG_OP` is the exported op constant map. `colorTie` decides which operand's
palette index wins at voxels present in both.

## Gotchas

- **Operands must be `VoxelGrid` instances.** Parse a `.vox` with `parseVox`,
  then turn its `model.voxels` into a grid with `gridFromMap` (key = `"x,y,z"`,
  value = palette index). See the `voxel-core` skill.
- **`difference` is order-sensitive**: `a - b` ≠ `b - a`.
- Output is always `.vox`; the CLI writes it and reports byte size + voxel count.
