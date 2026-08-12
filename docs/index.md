---
layout: home

hero:
  name: voxel-tool
  text: MagicaVoxel .vox toolkit
  tagline: Pure-JS core + Three.js real-3D viewer (React / Vue / Solid / Preact / Svelte / Qwik)
  actions:
    - theme: brand
      text: Get Started
      link: /guide/installation
    - theme: alt
      text: API Reference
      link: /api/core
  features:
    - title: Zero-dependency core
      details: '@voxel-tool/core reads/writes .vox, palettes and voxel grids in pure JS — runs in Node and the browser with no runtime dependencies.'
    - title: True 3D rendering
      details: Every voxel is a real cube; the WebGL depth buffer handles occlusion correctly. Face culling trims 6×N faces down to the shell, so even large models render instantly.
    - title: Animation & .vox round-trip
      details: 'Core parses MagicaVoxel frame animation (FRAM + nTRN keyframes) and writes it back losslessly; the exporter bakes the motion into glTF/GLB animation clips, and can re-encode any model straight back to .vox.'
    - title: Greedy meshing + WebGPU
      details: 'Greedy meshing merges coplanar same-color faces, collapsing solid models by 1000×+ in triangle count. An optional WebGPU backend (with automatic WebGL fallback) is available on demand.'
    - title: Six framework components
      details: Drop-in <code>VoxViewer</code> components for React / Vue / Solid / Preact / Svelte / Qwik — drag to rotate, scroll to zoom, right-drag to pan.

---

<div style="text-align:center">
  <img src="/media/voxel-tool-promo.gif" alt="voxel-tool — 60-second project showcase" width="720"/>
</div>

## What is this?

**voxel-tool** is a JavaScript toolkit for [MagicaVoxel](https://ephtracy.github.io/) `.vox` voxel models:

- **`@voxel-tool/core`** — Pure-JS core: `.vox` read/write, palette helpers, and the `VoxelGrid` container.
- **`@voxel-tool/viewer`** — Framework-agnostic Three.js viewer core (`createVoxelViewer` + `buildVoxelGeometry`); every framework component reuses it.
- **`@voxel-tool/exporter`** — Standalone export library: voxel models → GLB / glTF / OBJ / STL / PLY / USDZ / FBX, plus lossless `.vox` round-trip and glTF/GLB animation baking.
- **`@voxel-tool/react`** — React 3D viewer component (Three.js).
- **`@voxel-tool/vue`** — Vue 3 3D viewer component (same rendering approach).
- **`@voxel-tool/solid`** — SolidJS 3D viewer component.
- **`@voxel-tool/preact`** — Preact 3D viewer component.
- **`@voxel-tool/svelte`** — Svelte 5 3D viewer component.
- **`@voxel-tool/qwik`** — Qwik 3D viewer component.

The renderer follows the approach of mainstream `.vox` viewers: real 3D cubes + depth buffer + face culling + orthographic isometric camera + OrbitControls, leaving Canvas 2D painter's-algorithm sorting artifacts behind. Every framework component shares the single `@voxel-tool/viewer` implementation — no duplicated rendering code per framework.

```bash
npm install @voxel-tool/core @voxel-tool/react
```

```jsx
import { VoxViewer } from '@voxel-tool/react';
import { parseVox } from '@voxel-tool/core';

const buf = await fetch('/model.vox').then((r) => r.arrayBuffer());
const { models, palette } = parseVox(buf);

export default function App() {
  return <VoxViewer model={models[0]} palette={palette} />;
}
```

🇨🇳 [中文文档](/zh/)
