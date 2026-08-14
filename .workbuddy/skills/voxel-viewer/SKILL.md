---
name: voxel-viewer
description: >-
  This skill should be used when the user wants to render a MagicaVoxel `.vox`
  model in a web page or app — either with the framework-agnostic
  `createVoxelViewer` (vanilla JS / any framework) or the drop-in `VoxViewer`
  components for React, Vue, Solid, Preact, Svelte, or Qwik. It covers the
  viewer options (src/model/instances/palette/renderer/tsl), the browser-only
  constraint, WebGPU vs WebGL fallback, and per-framework component usage.
  Trigger phrases include "show the vox model", "embed a voxel viewer", "render
  .vox in react", "3d preview component", or any request to display a voxel
  model on screen.
agent_created: true
---

# voxel-viewer — 在网页中渲染体素模型

Render a real 3D voxel model (true cubes, depth-buffer occlusion, face-culling,
greedy meshing) in the browser. Two layers:

- **`@voxel-tool/viewer`** — `createVoxelViewer(container, options)`: framework-agnostic core.
- **`@voxel-tool/react|vue|solid|preact|svelte|qwik`** — thin `VoxViewer` components wrapping it.

## Browser-only

`createVoxelViewer` requires `window` and a DOM container — it runs in the
browser, not Node. For headless conversion, use `@voxel-tool/exporter` / the
`voxel-export` CLI instead.

## Method A — `createVoxelViewer` (vanilla / any framework)

```js
import { createVoxelViewer } from '@voxel-tool/viewer';

const viewer = createVoxelViewer(containerEl, {
  src: voxArrayBuffer,   // .vox binary (ArrayBuffer / Uint8Array) — single model
  // model: { size, voxels },            // OR already-parsed model
  // instances: [{ voxels, translation?, rotation?, hidden?, name? }],  // OR multi-instance
  palette: palette256,   // 256 x [r,g,b,a]; optional
  background: '#16181e',
  width: 480, height: 480,
  renderer: 'webgpu',    // 'webgpu' (default, auto-falls back to 'webgl2') | 'webgl'
  frameRate: 12, loop: true,
  onBackend: (b) => console.log('backend:', b),     // 'webgl' | 'webgpu'
  onInfo: (info) => console.log(info && `${info[0]} voxels · ${info[1]} faces`),
  tsl: { outline: true, outlineColor: 0x000000, emissive: true, emissiveIntensity: 0.4 }, // WebGPU only
});

// later: viewer.update({ src }); viewer.setBackground('#000'); viewer.dispose();
```

- **One of `src` / `model` / `instances` is required.**
- **`renderer: 'webgpu'` is default** and auto-falls back to WebGL2 when
  WebGPU is unavailable. Pass `renderer: 'webgl'` to force the classic path.
- **`tsl` (TSL outline/emissive) only works on the WebGPU backend.**

## Method B — Framework `VoxViewer` components

All six packages export a default `VoxViewer` with the identical prop shape:
`src`, `model`, `palette`, `background`, `width`, `height`. Install the matching
package (`@voxel-tool/react|vue|solid|preact|svelte|qwik`) and drop it in.

```jsx
// React
import VoxViewer from '@voxel-tool/react';
<VoxViewer src={voxBytes} width={480} height={480} background="#16181e" />
```

Full per-framework snippets (Vue `<script setup>`, Solid, Preact, Svelte, Qwik)
and peer-dependency ranges are in **`references/components.md`**.

## Gotchas

- **`src` must be an `ArrayBuffer` / `Uint8Array` of the `.vox` binary** — fetch
  the file and pass the bytes; do not pass a URL string.
- **WebGPU needs a secure context** (https or localhost). On plain http the
  viewer auto-falls back to WebGL2 — visuals are identical, only `tsl` effects
  are skipped.
- **Hot editor note**: in `apps/vox-editor`, the WebGPU canvas is swapped in
  after init — pointer listeners are re-attached there; for a plain embed you
  don't need to worry about that.
- **Animation**: pass `frameRate`/`loop`; playback controls (`play`/`pause`) are
  on the viewer instance, not the component props.
