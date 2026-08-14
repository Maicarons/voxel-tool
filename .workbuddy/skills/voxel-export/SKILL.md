---
name: voxel-export
description: >-
  This skill should be used when the user wants to convert a MagicaVoxel `.vox`
  (or Minecraft `.schem`) file to a general 3D format — GLB, glTF, OBJ, STL,
  PLY, USDZ, FBX — or the reverse: voxelize a mesh (GLB/glTF/OBJ/STL) back into
  a `.vox`. It covers the headless `voxel-export` CLI (flags, formats, Draco
  compression, resolution) with copy-paste-ready commands. Trigger phrases
  include "convert .vox to glb", "export voxel model", "voxelize this mesh",
  "compress glb with draco", or any request to move a voxel model in or out of
  the `.vox` format.
agent_created: true
---

# voxel-export — `.vox` ↔ 3D 格式双向转换

Use the `@voxel-tool/cli` `voxel-export` command to convert voxel models to/from
general 3D formats, fully headless in Node (no browser needed).

## When to use

- Forward: `.vox` / `.schem` → `glb | gltf | obj | stl | ply | usdz | fbx | vox | schem`
- Reverse: `.glb` / `.gltf` / `.obj` / `.stl` → `.vox` (mesh voxelization, P4.5)
- Compress a `.vox`→`glb` with Draco to shrink file size 10×+
- List supported formats

## How to invoke

The CLI ships as `voxel-export` (bin of `@voxel-tool/cli`). Two ways to run it:

1. **From this repo** (no install): run the bin directly from the repo root.
   ```bash
   node packages/cli/bin/voxel-export.mjs <input> [options]
   ```
2. **Installed / anywhere**: `npx @voxel-tool/cli voxel-export <input> [options]`
   or globally `npm i -g @voxel-tool/cli` then `voxel-export <input> [options]`.

The CLI auto-detects direction by the **input extension**:
- `.vox` / `.schem` → forward export to a 3D format
- `.glb` / `.gltf` / `.obj` / `.stl` → reverse voxelization to `.vox`

Requires Node ≥ 18. The command is async and writes the output file itself.

## Flags

| Flag | Alias | Effect |
|------|-------|--------|
| `-f, --format <fmt>` | | Output format (see list). Default `glb`. |
| `-o, --output <path>` | | Output path. Default `<input>.<fmt>`. |
| `--ascii` | | Use ASCII for `stl`/`ply` (default binary). |
| `-d, --draco` | | Draco-compress `glb`/`gltf` (smaller, keeps PBR + animation). |
| `-r, --resolution <n>` | | Reverse voxelization resolution (max-dimension voxels). Default `64`. Also `nx,ny,nz`. |
| `--solid` | | Reverse: solid fill (needs a closed manifold). Default `shell`. |
| `--pad <n>` | | Reverse: expand bounding box by `n` voxels. Default `0`. |
| `-l, --list` | | Print supported formats and exit. |
| `-h, --help` | | Print help and exit. |

Supported formats (from `-l`): `glb gltf obj stl ply usdz fbx vox schem`
(`vox`/`schem` appear because the CLI can also round-trip back to voxel formats.)

## Examples

```bash
# Forward — default glb
node packages/cli/bin/voxel-export.mjs model.vox

# Forward — explicit format + output path
node packages/cli/bin/voxel-export.mjs model.vox -f obj -o model.obj

# Forward — Draco-compressed GLB (10×+ smaller)
node packages/cli/bin/voxel-export.mjs model.vox -d

# Forward — ASCII STL
node packages/cli/bin/voxel-export.mjs model.vox -f stl --ascii

# Forward — export to Minecraft schematic
node packages/cli/bin/voxel-export.mjs model.vox -f schem -o model.schem

# Reverse — voxelize a GLB into .vox at resolution 96
node packages/cli/bin/voxel-export.mjs model.glb -r 96 -o model.vox

# Reverse — solid voxelization of an STL
node packages/cli/bin/voxel-export.mjs model.stl --solid -r 48 -o model.vox

# From a Minecraft .schem back to GLB
node packages/cli/bin/voxel-export.mjs model.schem -f glb -o model.glb
```

A repo sample exists at `packages/core/sample.vox` for quick tests.

## Gotchas

- **Reverse voxelization only triggers for mesh inputs** (`.glb/.gltf/.obj/.stl`).
  Passing a `.vox` always forward-exports; passing a `.glb` always voxelizes.
- **Draco-compressed GLB/GLTF cannot be reverse-voxelized by this CLI.** The
  reverse path uses three's `GLTFLoader` without a `DRACOLoader`, so a `.glb`
  produced with `-d` will fail with *"No DRACOLoader instance provided"*. For a
  round-trip, reverse-voxelize a **plain** (non-`-d`) GLB, or decompress first.
  Similarly, consuming a Draco GLB in the viewer/exporter needs a `DRACOLoader`
  attached on the consumer side.
- **`-d` / Draco applies only to `glb`/`gltf`.** It has zero cost (dynamic
  import) when omitted. Consumers need `draco3d` + `@gltf-transform/*` to decode.
- **Resolution default is 64**; raise it for detail, lower it for speed. Use
  `nx,ny,nz` for non-uniform grids.
- **`--solid` requires a closed manifold mesh**; otherwise use the default `shell`
  (surface shell, no closure needed).
- The output file is created next to the input unless `-o` is given.
