# Command-line tools (`@voxel-tool/cli`)

A headless Node CLI — **no browser required**. Two binaries are provided:

- **`voxel-export`** — convert `.vox` / `.schem` ↔ GLB / glTF / OBJ / STL / PLY / USDZ / FBX, export Minecraft Schematic, and voxelize meshes (`.glb` / `.stl` → `.vox`).
- **`voxel-csg`** — run boolean CSG (union / intersection / difference) on two voxel files.

## Install

```bash
npm install -g @voxel-tool/cli
# or run on demand:
npx @voxel-tool/cli voxel-export model.vox
```

## `voxel-export`

### Forward: `.vox` / `.schem` → 3D formats

```bash
voxel-export model.vox                       # -> model.glb (default)
voxel-export model.vox -f obj -o model.obj
voxel-export model.vox -f fbx
voxel-export model.vox -f stl --ascii
voxel-export model.vox -f schem -o model.schem   # -> Minecraft Schematic
voxel-export model.schem -f glb -o model.glb      # Schematic -> GLB
voxel-export model.vox -d                          # Draco-compressed GLB
```

| Flag | Alias | Description |
|---|---|---|
| `--format <fmt>` | `-f` | `glb` (default), `gltf`, `obj`, `stl`, `ply`, `usdz`, `fbx`, `schem`, `vox` |
| `--output <path>` | `-o` | Output path (default `<input>-out.<fmt>`) |
| `--ascii` | | Text STL/PLY instead of binary |
| `--draco` | `-d` | Draco-compress GLB/glTF (10×+ smaller, keeps materials + animation) |
| `--list` | `-l` | List supported formats and exit |
| `--help` | `-h` | Show help |

### Reverse: mesh → `.vox` (voxelize)

Any `.glb` / `.gltf` / `.obj` / `.stl` can be voxelized back into a `.vox`:

```bash
voxel-export model.glb -r 96 -o model.vox          # resolution 96 on the longest axis
voxel-export model.stl --solid -r 48 -o model.vox  # solid fill (closed manifold)
voxel-export model.obj -r 64,64,128 -o model.vox   # explicit nx,ny,nz
```

| Flag | Alias | Description |
|---|---|---|
| `--resolution <n>` | `-r` | Max-axis voxel resolution (default `64`); or `nx,ny,nz` |
| `--solid` | | Solid mode (needs a closed manifold); default is surface `shell` |
| `--pad <n>` | | Expand bounding box by `n` voxels |

GLB/GLTF/PLY/USDZ/FBX preserve vertex colors; OBJ and STL carry geometry only (then voxelized by position). See [Usage](/guide/usage) for the library equivalent.

## `voxel-csg`

Combine two voxel files with boolean CSG:

```bash
voxel-csg union a.vox b.vox -o merged.vox
voxel-csg difference a.vox b.vox        # subtract b from a (carve a hole)
voxel-csg intersection a.vox b.vox      # keep the overlap
voxel-csg union a.vox b.vox --tie b     # conflict voxels take b's color
```

| Argument / Flag | Description |
|---|---|
| `<op>` | `union` / `intersection` / `difference` |
| `<a.vox>` `<b.vox>` | Operands (`.vox` or `.schem`) |
| `--output <path>` | `-o` | Output `.vox` (default `<a>_<op>_<b>.vox`) |
| `--tie <a\|b>` | Color at conflicting coordinates (default `a`) |
| `--help` | `-h` | Show help |

The operation is exact and fast — a set operation over voxel coordinate keys, not mesh CSG. See `voxelCSG` in the [core API](/api/core).
