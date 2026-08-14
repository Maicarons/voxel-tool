# voxel-tool

[![CI](https://github.com/Maicarons/voxel-tool/actions/workflows/ci.yml/badge.svg)](https://github.com/Maicarons/voxel-tool/actions/workflows/ci.yml)
[![Docs](https://github.com/Maicarons/voxel-tool/actions/workflows/pages.yml/badge.svg)](https://maicarons.github.io/voxel-tool/)
[![npm](https://img.shields.io/badge/npm-%40voxel--tool%2Fcore-blue)](https://www.npmjs.com/org/voxel-tool)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A JavaScript toolkit for **MagicaVoxel `.vox` files**: a dependency-free core library for reading/writing, plus real 3D viewer components built on Three.js — available for **React / Vue / SolidJS / Preact / Svelte / Qwik**.

- 📦 **`@voxel-tool/core`** — Dependency-free core (`.vox` read/write, palettes, voxel grid `VoxelGrid`), runs in Node and the browser with zero runtime dependencies. Also parses and writes MagicaVoxel **frame animation** (FRAM + nTRN keyframes) losslessly.
- 🔷 **`@voxel-tool/mesh`** — Shared voxel-geometry core (Three.js): the single implementation of face-culling + greedy-meshing `buildVoxelGeometry`, reused by both `@voxel-tool/viewer` and `@voxel-tool/exporter`. Color-space (`raw` vs sRGB→linear) and material differences are parameterized, so the algorithm lives in exactly one place.
- 🧩 **`@voxel-tool/viewer`** — Framework-agnostic Three.js viewer core (`createVoxelViewer` + `buildVoxelGeometry`); every framework component reuses the same rendering implementation. Supports **animation playback** (`play`/`pause`/`setFrame`/…) and an optional **WebGPU** backend (auto-fallback to WebGL).
- 📤 **`@voxel-tool/exporter`** — Standalone export library: voxel models → GLB / glTF / OBJ / STL / PLY / USDZ / FBX, plus lossless `.vox` round-trip, glTF/GLB **animation baking**, and **Draco** compression.
- 🖥️ **`@voxel-tool/cli`** — Headless Node CLI: convert `.vox` ↔ GLB / glTF / OBJ / STL / PLY / USDZ / FBX, **voxelize meshes** (`.glb`/`.stl` → `.vox`), run **boolean CSG** (union/intersection/difference), and round-trip **Minecraft Schematic** — no browser required.
- ⚛️ **`@voxel-tool/react`** — React 3D viewer component.
- 🟢 **`@voxel-tool/vue`** — Vue 3 3D viewer component.
- 🔵 **`@voxel-tool/solid`** — SolidJS 3D viewer component.
- 🟡 **`@voxel-tool/preact`** — Preact 3D viewer component.
- 🧡 **`@voxel-tool/svelte`** — Svelte 5 3D viewer component.
- 💜 **`@voxel-tool/qwik`** — Qwik 3D viewer component.

> The rendering follows mainstream `.vox` viewers (MagicaVoxel / `threejs-vox-loader` / coding.kiwi's *Rendering .vox Files*): every voxel is a real 3D cube correctly occluded by the WebGL depth buffer; only exposed faces are generated (face culling), and **greedy meshing** merges coplanar same-color faces so even solid models collapse to a handful of triangles and render instantly. All framework components share the single `@voxel-tool/viewer` implementation — no per-framework re-implementation of the renderer.

<p align="center">
  <img src="media/voxel-tool-promo.gif" alt="voxel-tool — 60-second project showcase" width="720"/>
</p>

---

## Repository structure

```
voxel-tool/
├── packages/
│   ├── core/        @voxel-tool/core    dependency-free core (read/write / palettes / grid)
│   ├── mesh/        @voxel-tool/mesh    shared voxel geometry core (face culling + greedy meshing, Three.js)
│   ├── viewer/      @voxel-tool/viewer  framework-agnostic viewer core (Three.js)
│   ├── exporter/    @voxel-tool/exporter standalone export library (8 formats + .vox round-trip + Draco)
│   ├── cli/         @voxel-tool/cli     headless Node CLI (convert / voxelize / boolean CSG / Schematic)
│   ├── react/       @voxel-tool/react   React 3D viewer component
│   ├── vue/         @voxel-tool/vue     Vue 3 3D viewer component
│   ├── solid/       @voxel-tool/solid   SolidJS 3D viewer component
│   ├── preact/      @voxel-tool/preact  Preact 3D viewer component
│   ├── svelte/      @voxel-tool/svelte  Svelte 5 3D viewer component
│   └── qwik/        @voxel-tool/qwik     Qwik 3D viewer component
├── docs/           VitePress documentation site
├── apps/
│   └── vox-editor/ complete React voxel editor app (runnable, not a library)
├── .github/
│   └── workflows/   CI + publish automation
├── LICENSE
├── README.md
└── package.json    npm workspaces root
```

## Quick start

```bash
# Install (npm workspaces links all packages automatically)
npm install

# Build all packages (output goes to packages/*/dist)
npm run build

# Run tests
npm test

# Preview each framework's component example locally
npm run dev:react    # -> http://localhost:5173
npm run dev:vue      # -> http://localhost:5174
npm run dev:solid    # -> http://localhost:5176
npm run dev:preact   # -> http://localhost:5175
npm run dev:svelte   # -> http://localhost:5177
npm run dev:qwik     # -> http://localhost:5178
```

### Read and view a `.vox`

```jsx
// React
import { VoxViewer } from '@voxel-tool/react';
import { parseVox } from '@voxel-tool/core';

const buf = await fetch('/model.vox').then((r) => r.arrayBuffer());
const { models, palette } = parseVox(buf);

function App() {
  return <VoxViewer model={models[0]} palette={palette} />;
}
```

```vue
<!-- Vue -->
<script setup>
import { VoxViewer } from '@voxel-tool/vue';
import { parseVox } from '@voxel-tool/core';

const buf = await fetch('/model.vox').then((r) => r.arrayBuffer());
const { models, palette } = parseVox(buf);
</script>

<template>
  <VoxViewer :model="models[0]" :palette="palette" />
</template>
```

```tsx
// SolidJS
import { VoxViewer } from '@voxel-tool/solid';
import { parseVox } from '@voxel-tool/core';

const buf = await fetch('/model.vox').then((r) => r.arrayBuffer());
const { models, palette } = parseVox(buf);

function App() {
  return <VoxViewer model={models[0]} palette={palette} />;
}
```

```jsx
// Preact (import from 'preact' / 'preact/hooks')
import { VoxViewer } from '@voxel-tool/preact';
import { parseVox } from '@voxel-tool/core';

const buf = await fetch('/model.vox').then((r) => r.arrayBuffer());
const { models, palette } = parseVox(buf);

export function App() {
  return <VoxViewer model={models[0]} palette={palette} />;
}
```

```svelte
<!-- Svelte 5 (runes) -->
<script>
  import { VoxViewer } from '@voxel-tool/svelte';
  import { parseVox } from '@voxel-tool/core';

  let models, palette;
  fetch('/model.vox').then((r) => r.arrayBuffer()).then((buf) => {
    const res = parseVox(buf);
    models = res.models;
    palette = res.palette;
  });
</script>

{#if models}
  <VoxViewer model={models[0]} palette={palette} size={[480, 480]} />
{/if}
```

```tsx
// Qwik (the viewer mounts only when visible in the browser)
import { component$ } from '@builder.io/qwik';
import { VoxViewer } from '@voxel-tool/qwik';
import { parseVox } from '@voxel-tool/core';

const buf = await fetch('/model.vox').then((r) => r.arrayBuffer());
const { models, palette } = parseVox(buf);

export const App = component$(() => {
  return <VoxViewer model={models[0]} palette={palette} />;
});
```

## Voxel Editor (complete app)

A full, runnable **`.vox` voxel editor** built with React + Three.js on top of `@voxel-tool/core` — a standalone project, not a reusable library.

```bash
npm run dev:editor     # -> http://localhost:5180
```

Features: click-to-paint / click-to-erase on a live 3D view (raycasting against cube faces), a 256-color palette, orbit/pan/zoom, undo, load & save `.vox`, export to PNG **or 3D formats**, **non-destructive layers**, **boolean CSG** (union / intersection / difference), a **symmetry brush**, **TSL outline/emissive** enhancement, and a **WebGPU** backend with automatic WebGL2 fallback. See **[apps/vox-editor](apps/vox-editor)**.

## Documentation

Full documentation (installation, usage, API, component examples) is available online: **https://maicarons.github.io/voxel-tool/**

Source lives in **[docs/](docs/)** (VitePress).

Start the docs site locally:

```bash
npm run docs:dev
```

## License

[MIT](LICENSE) © 2026 Maicarons

---

🇨🇳 中文版说明见 [README_zh.md](./README_zh.md)。
