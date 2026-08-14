# AI integration (project skills)

voxel-tool ships a set of **project-level WorkBuddy skills** in [`.workbuddy/skills/`](https://github.com/Maicarons/voxel-tool/tree/main/.workbuddy/skills). They are committed to the repo, so any AI agent (or anyone using WorkBuddy) that opens this project can call voxel-tool directly — no separate install, no hunting through docs.

## Why

Instead of re-deriving every CLI flag and API signature each time, the agent loads a skill and immediately gets copy-paste-ready commands, accurate function signatures, and the gotchas we already discovered (e.g. Draco GLB cannot be reverse-voxelized by the CLI).

## The skills

| Skill | Trigger phrases | What it covers |
|-------|-----------------|----------------|
| `voxel-tool` | "what can this project do", "use AI to call this project" | **Router** — package map + decision table pointing to the right sub-skill. |
| `voxel-export` | "convert .vox to glb", "voxelize this mesh", "compress with draco" | Headless `voxel-export` CLI: `.vox`/`.schem` ↔ GLB/glTF/OBJ/STL/PLY/USDZ/FBX, reverse voxelize, Draco. |
| `voxel-csg` | "merge two .vox", "subtract b from a", "carve a hole" | Boolean union / intersection / difference (CLI + `voxelCSG` API). |
| `voxel-schematic` | "export to minecraft schematic", "import .schem" | Minecraft `.schem` ↔ GLB/VOX round-trip (CLI + `parseSchematic`/`voxelToSchematic`). |
| `voxel-core` | "read this .vox in node", "write a .vox from code", "count voxels" | Programmatic `.vox` read/write: `parseVox`, `toVoxBytesScene`, `VoxelGrid`, `voxelizeMesh`, palette. |
| `voxel-viewer` | "show the vox model", "render .vox in react", "embed a viewer" | `createVoxelViewer` + React/Vue/Solid/Preact/Svelte/Qwik `VoxViewer`. |

## Which skill to use

- Want a **one-line CLI** conversion → `voxel-export` or `voxel-csg`.
- Want to **script** voxel data → `voxel-core` (import in Node).
- Want to **display** a model in the browser → `voxel-viewer`.
- Not sure → `voxel-tool` (the router) tells you.

## Example prompts

> "Convert `models/castle.vox` to a Draco-compressed GLB."
> → `voxel-export` → `node packages/cli/bin/voxel-export.mjs models/castle.vox -d`

> "Merge `a.vox` and `b.vox`, using b's color where they overlap."
> → `voxel-csg` → `node packages/cli/bin/voxel-csg.mjs union a.vox b.vox --tie b`

> "Read `ship.vox` in Node and count how many voxels use palette index 12."
> → `voxel-core` → `parseVox` + `VoxelGrid`/`grid.list()` filter.

> "Render `hero.vox` inside a React page at 480×480."
> → `voxel-viewer` → `@voxel-tool/react` `<VoxViewer src={bytes} width={480} height={480} />`.

> "Turn this `.vox` into a Minecraft `.schem` I can paste into WorldEdit."
> → `voxel-schematic` → `voxel-export ... -f schem`

## Notes

- The CLI and core are **headless** (Node ≥ 18, no browser). The viewer is **browser-only** (WebGPU default, WebGL2 fallback).
- Within the repo, run the CLI from the root: `node packages/cli/bin/<cmd>.mjs <args>`.
- For full signatures and per-framework snippets, the skills reference `references/api-reference.md` and `references/components.md` (read on demand).
