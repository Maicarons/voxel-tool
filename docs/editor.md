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
| **New Model** | Start fresh with an empty 24×24×24 canvas |
| **Demo** | Loads a colorful sphere demo on first open |

## Controls

- **Left-click + drag** on the 3D view: rotate camera
- **Scroll**: zoom in/out
- **Right-click + drag** pan the view
- **Paint/Erase**: select mode from toolbar, then left-click voxels

## Tech Stack

- **React 18** + **Three.js** for rendering
- **@voxel-tool/core** for `.vox` file I/O and voxel data structures
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
