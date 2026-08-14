---
name: voxel-schematic
description: >-
  This skill should be used when the user wants to interchange voxel-tool
  models with the Minecraft Schematic format (`.schem`, Sponge v2 / GZip+NBT).
  It covers converting a `.vox` to a `.schem` (for use in Minecraft / WorldEdit
  / MCEdit) and importing a `.schem` back to GLB or `.vox`. Both the headless
  `voxel-export` CLI and the programmatic `parseSchematic` / `voxelToSchematic`
  API from `@voxel-tool/core` are covered. Trigger phrases include "export to
  minecraft schematic", "convert .vox to .schem", "import schematic", "minecraft
  voxel", or "schematic round-trip".
agent_created: true
---

# voxel-schematic — Minecraft `.schem` 互操作

Round-trip voxel models with the Minecraft Schematic format. The format is
Sponge v2 (GZip-compressed NBT), written/read by zero-dependency, browser-safe
code in `@voxel-tool/core` (no `node:fs`, uses the Web `CompressionStream` API).

## When to use

- Turn a `.vox` into a `.schem` for Minecraft / WorldEdit / MCEdit.
- Turn a `.schem` into a GLB/GLTF to preview in a 3D viewer.
- Read a `.schem` programmatically and feed it straight into the viewer/exporter
  (its output is `parseVox`-compatible).
- Write a voxel model back to `.schem` from code.

## Method A — CLI `voxel-export`

The `voxel-export` CLI treats `.schem` as just another voxel format, so no
separate command is needed.

```bash
# .vox -> .schem
node packages/cli/bin/voxel-export.mjs model.vox -f schem -o model.schem

# .schem -> GLB (preview / convert)
node packages/cli/bin/voxel-export.mjs model.schem -f glb -o model.glb

# .schem -> .vox (back to MagicaVoxel format)
node packages/cli/bin/voxel-export.mjs model.schem -f vox -o model.vox
```

## Method B — Programmatic API (Node / browser)

Both functions are `async` and live in `@voxel-tool/core`:

```js
import { parseSchematic, voxelToSchematic, parseVox } from '@voxel-tool/core';
import { readFile, writeFile } from 'node:fs/promises';

// .schem -> voxel data (parseVox-compatible: { models, palette, scene })
const bytes = new Uint8Array(await readFile('build.schem'));
const vox = await parseSchematic(bytes);   // -> { models, palette, ... }

// voxel data -> .schem (write back to Minecraft)
const schemBytes = await voxelToSchematic(vox, { fallbackBlock: 'minecraft:stone' });
await writeFile('build.schem', Buffer.from(schemBytes));
```

### Signatures

```ts
parseSchematic(input: Uint8Array | ArrayBuffer): Promise<{
  models: { size: [number, number, number], voxels: { x, y, z, i }[] }[],
  palette: number[][],            // 256 x [r,g,b,a]
  scene?: any[], materials?: object, frameCount?: number
}>

voxelToSchematic(vox: parseVoxResult | { model: { size, voxels }, palette },
                 opts?: { fallbackBlock?: string }): Promise<Uint8Array>
```

`parseSchematic` output is directly consumable by `@voxel-tool/viewer`
(`createVoxelViewer`) and `@voxel-tool/exporter` (`VoxelExporter`) — no extra
conversion needed.

`blockColor(blockName)` maps a Minecraft block state string to an approximate
`[r,g,b,a]`; `voxelToSchematic` uses it to pick the closest block for each color.

## Gotchas

- **`.schem` writing is GZip + NBT**, but the code uses the Web
  `CompressionStream`/`DecompressionStream` API, so it runs in the browser too
  (do **not** `import('node:zlib')` in core).
- **Color → block mapping is lossy.** Unmatched colors fall back to
  `opts.fallbackBlock` (default `minecraft:stone`). Expect a Minecraft-ish but
  not pixel-exact palette after a round-trip.
- **Axis orientation**: MagicaVoxel and Minecraft use different Y-up
  conventions; the round-trip preserves the data as-is. Rotate in-editor if a
  flip is needed.
- An empty voxel set throws (`voxelToSchematic: 没有体素可写`).
