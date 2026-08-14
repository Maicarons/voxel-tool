# Voxel Editor

A full-featured **MagicaVoxel `.vox` editor** running entirely in your browser — load, edit, and export voxel models without installing anything.

<div class="editor-cta">
  <a href="/voxel-tool/editor/" target="_blank" rel="noopener noreferrer" class="cta-button">
    Open Editor
  </a>
</div>

## Features

| Feature | Description |
|---|---|
| **Load / Save** | Open any `.vox` file (MagicaVoxel format); save back to `.vox` |
| **Paint Mode** | Click or drag on the 3D canvas to place voxels with the selected color |
| **Erase Mode** | Remove individual voxels by clicking them |
| **Color Palette** | Full MagicaVoxel palette with 255 colors; click to pick |
| **Undo** | Undo last action (`Ctrl+Z`) |
| **Grid Toggle** | Show/hide the coordinate grid overlay |
| **Export PNG** | Render current view to a PNG image |
| **Export 3D models** | Export the current model to **GLB / glTF / OBJ / STL / PLY / USDZ / FBX** (powered by `@voxel-tool/exporter`) |
| **New Model** | Start fresh with an empty 24×24×24 canvas |
| **Demo** | Loads a colorful sphere demo on first open |
| **Layers** | Non-destructive layer panel — add / delete / reorder / rename layers, toggle visibility, set per-layer opacity; painting affects only the active layer |
| **Boolean CSG** | Combine two models with union / intersection / difference (load a second `.vox` and apply) |
| **Symmetry brush** | Mirror painting across X / Y / Z axes — model symmetric structures in one stroke |
| **TSL enhancement** | Optional Fresnel rim outline + emissive glow (Three Shading Language, WebGPU only) |
| **WebGPU backend** | Renders with WebGPU by default and falls back to WebGL2 automatically; a badge shows the active backend |

## Controls

- **Left-click + drag** on the 3D view: rotate camera
- **Scroll**: zoom in/out
- **Right-click + drag** pan the view
- **Paint/Erase**: select mode from toolbar, then left-click voxels

## Export 3D models

Use the **Export Model** control in the toolbar: pick a format from the dropdown, then click **Export Model** to download the current voxel model.

| Format | Color | Best for |
|---|---|---|
| GLB / glTF | vertex colors | game engines, web, general use |
| PLY | vertex colors | point clouds, scanning |
| USDZ | vertex colors | AR on Apple devices |
| FBX | vertex colors | DCC tools (Blender, Maya, Unity) |
| OBJ | geometry only | simple mesh interchange |
| STL | geometry only | 3D printing |

> OBJ and STL carry geometry only (a limitation of the underlying Three.js exporters) — use GLB / glTF / PLY / USDZ / FBX when you need vertex colors.

## Advanced editing

### Layers (non-destructive)

The editor stores your model as a stack of layers. Painting and erasing only affect the **active** layer, and layer visibility / opacity affect **rendering only** — your voxel data is never destroyed when you hide or fade a layer. The **Layers** panel (right side) lets you:

- **Add / delete / reorder / rename** layers (at least one layer is always kept).
- **Toggle visibility** of any layer.
- **Set per-layer opacity** (0–1); values below 1 render the layer semi-transparent.
- Pick the **active** layer to paint into.

Export and save always composite all visible layers into a single model, so non-destructive editing never loses data.

### Boolean CSG

Combine the active layer with a second model using constructive solid geometry:

1. Pick an operation in the toolbar — **union** (A ∪ B), **intersection** (A ∩ B), or **difference** (A − B).
2. Click **CSG Apply** and choose a second `.vox` (or `.schem`) file.

The operation runs on voxel coordinate keys (a set operation over the grid), so it is exact and fast — no mesh CSG required. The conflict color defaults to the primary (A) operand; see `voxelCSG` in the [core API](/api/core) for the underlying function.

### Symmetry brush

Enable **X / Y / Z** mirror toggles in the toolbar to paint symmetric structures in a single stroke. Each placed voxel is mirrored across the enabled axes about the model's center, so you model one half and the editor fills the rest.

### TSL outline / emissive

The **TSL** toggle (toolbar) adds a Fresnel rim outline and/or an emissive glow using Three Shading Language. This enhances the WebGPU render path with real-time shading nodes; the toggle is disabled automatically when running on the WebGL2 fallback (classic materials degrade gracefully).

### WebGPU backend

The editor renders with **WebGPU** by default and **automatically falls back to WebGL2** when the browser/device lacks WebGPU support. A small badge in the top-right corner shows the active backend (`WebGPU` / `WebGL2`) so you always know which path is live.

## Tech Stack

- **React** + **Three.js** for rendering (WebGPU by default, WebGL2 fallback)
- **@voxel-tool/core** for `.vox` file I/O, voxel data structures, boolean CSG, symmetry and mesh voxelization
- **Vite** for build, deployed as a static SPA at `/voxel-tool/editor/`

## Running Locally

```bash
npm run dev:editor    # dev server on port 5180
npm run build:editor # production build → apps/vox-editor/dist
```

<style>
.editor-cta { text-align: center; margin: 2rem 0; }
.cta-button {
  display: inline-block;
  padding: 14px 36px;
  font-size: 1.15rem;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border-radius: 10px;
  text-decoration: none;
  transition: transform .15s, box-shadow .15s;
  box-shadow: 0 4px 14px rgba(99,102,241,.35);
}
.cta-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(99,102,241,.5);
}
</style>
