# voxel-tool

[![CI](https://github.com/Maicarons/voxel-tool/actions/workflows/ci.yml/badge.svg)](https://github.com/Maicarons/voxel-tool/actions/workflows/ci.yml)
[![Docs](https://github.com/Maicarons/voxel-tool/actions/workflows/pages.yml/badge.svg)](https://maicarons.github.io/voxel-tool/)
[![npm](https://img.shields.io/badge/npm-%40voxel--tool%2Fcore-blue)](https://www.npmjs.com/org/voxel-tool)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

一套用于 **MagicaVoxel `.vox` 文件** 的 JavaScript 工具集：纯 JS 读写核心库 + 基于 Three.js 真实 3D 渲染的查看器组件，覆盖 **React / Vue / SolidJS / Preact / Svelte / Qwik** 六大框架。

- 📦 **`@voxel-tool/core`** — 纯 JS 核心库：`.vox` 读写、调色板、体素网格（`VoxelGrid`），Node 与浏览器通用，零运行时依赖。还能**无损解析与写回** MagicaVoxel 帧动画（FRAM + nTRN 关键帧）。
- 🔷 **`@voxel-tool/mesh`** — 共享体素几何核心 (Three.js)：面剔除 + greedy meshing 的 `buildVoxelGeometry` 单一实现，被 `@voxel-tool/viewer` 与 `@voxel-tool/exporter` 共用；颜色空间（`raw` / sRGB→linear）与材质差异通过参数表达，算法只存在一处。
- 🧩 **`@voxel-tool/viewer`** — 框架无关的 Three.js 查看器核心（`createVoxelViewer` + `buildVoxelGeometry`），所有框架组件都复用同一套渲染实现。支持**动画播放**（`play`/`pause`/`setFrame`/…）与可选 **WebGPU** 后端（自动回退 WebGL）。
- 📤 **`@voxel-tool/exporter`** — 独立导出库：体素模型 → GLB / glTF / OBJ / STL / PLY / USDZ / FBX，并支持 `.vox` 无损往返、glTF/GLB **动画烘焙**与 **Draco** 压缩。
- 🖥️ **`@voxel-tool/cli`** — 无头 Node CLI：`.vox` ↔ GLB / glTF / OBJ / STL / PLY / USDZ / FBX 双向转换、**网格体素化**（`.glb`/`.stl` → `.vox`）、**布尔 CSG**（并/交/差），以及 **Minecraft Schematic** 往返——无需浏览器。
- ⚛️ **`@voxel-tool/react`** — React 3D 查看器组件。
- 🟢 **`@voxel-tool/vue`** — Vue 3 3D 查看器组件。
- 🔵 **`@voxel-tool/solid`** — SolidJS 3D 查看器组件。
- 🟡 **`@voxel-tool/preact`** — Preact 3D 查看器组件。
- 🧡 **`@voxel-tool/svelte`** — Svelte 5 3D 查看器组件。
- 💜 **`@voxel-tool/qwik`** — Qwik 3D 查看器组件。

> 渲染原理参考主流 `.vox` viewer（MagicaVoxel / `threejs-vox-loader` / coding.kiwi 的 *Rendering .vox Files*）：每个体素是真实 3D 立方体，靠 WebGL 深度缓冲正确遮挡；只对暴露面生成几何（面剔除），再用 **greedy meshing** 合并共面同色面，连实心模型都能塌缩成寥寥几个三角形、秒级渲染。所有框架组件共享 `@voxel-tool/viewer` 同一份实现，不存在「每个框架重写一遍渲染」的重复代码。

<p align="center">
  <img src="media/voxel-tool-promo.gif" alt="voxel-tool — 60 秒项目演示" width="720"/>
</p>

---

## 仓库结构

```
voxel-tool/
├── packages/
│   ├── core/        @voxel-tool/core    纯 JS 核心库 (读写/调色板/网格)
│   ├── mesh/        @voxel-tool/mesh    共享体素几何核心 (面剔除+greedy meshing, Three.js)
│   ├── viewer/      @voxel-tool/viewer  框架无关查看器核心 (Three.js)
│   ├── exporter/    @voxel-tool/exporter 独立导出库 (8 种格式 + .vox 往返 + Draco)
│   ├── cli/         @voxel-tool/cli     无头 Node CLI (转换 / 体素化 / 布尔 CSG / Schematic)
│   ├── react/       @voxel-tool/react   React 3D 查看器组件
│   ├── vue/         @voxel-tool/vue     Vue 3 3D 查看器组件
│   ├── solid/       @voxel-tool/solid   SolidJS 3D 查看器组件
│   ├── preact/      @voxel-tool/preact  Preact 3D 查看器组件
│   ├── svelte/      @voxel-tool/svelte  Svelte 5 3D 查看器组件
│   └── qwik/        @voxel-tool/qwik     Qwik 3D 查看器组件
├── docs/           VitePress 文档站点
├── apps/
│   └── vox-editor/ 完整的 React 体素编辑器项目 (可运行, 非库)
├── .github/
│   └── workflows/   CI + 发布自动化
├── LICENSE
├── README.md
└── package.json     npm workspaces 根
```

## 快速开始

```bash
# 安装 (npm workspaces 会自动链接所有包)
npm install

# 构建全部包 (产物进入 packages/*/dist)
npm run build

# 运行测试
npm test

# 本地预览各框架组件示例
npm run dev:react    # -> http://localhost:5173
npm run dev:vue      # -> http://localhost:5174
npm run dev:solid    # -> http://localhost:5176
npm run dev:preact   # -> http://localhost:5175
npm run dev:svelte   # -> http://localhost:5177
npm run dev:qwik     # -> http://localhost:5178
```

### 读取并查看一个 .vox

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
// Preact (import 来自 'preact' / 'preact/hooks')
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
// Qwik (组件在浏览器可见时才挂载查看器)
import { component$ } from '@builder.io/qwik';
import { VoxViewer } from '@voxel-tool/qwik';
import { parseVox } from '@voxel-tool/core';

const buf = await fetch('/model.vox').then((r) => r.arrayBuffer());
const { models, palette } = parseVox(buf);

export const App = component$(() => {
  return <VoxViewer model={models[0]} palette={palette} />;
});
```

## 体素编辑器 (完整项目)

一个可直接运行的 **`.vox` 体素编辑器**，基于 React + Three.js 构建在 `@voxel-tool/core` 之上——它是独立项目，不是可复用库。

```bash
npm run dev:editor     # -> http://localhost:5180
```

功能：在实时 3D 视图上点击绘制 / 点击擦除（射线拾取立方体面）、256 色调色板、旋转/平移/缩放、撤销、载入与保存 `.vox`、导出 PNG **或 3D 格式**、**非破坏式图层**、**布尔 CSG**（并/交/差）、**对称笔刷**、**TSL 描边/自发光**增强，以及 **WebGPU** 后端（自动回退 WebGL2）。详见 **[apps/vox-editor](apps/vox-editor)**。

## 文档

完整文档（安装、使用、API、组件示例）在线阅读：**https://maicarons.github.io/voxel-tool/**

源码在 **[docs/](docs/)**（VitePress）。

本地启动文档站点：

```bash
npm run docs:dev
```

## License

[MIT](LICENSE) © 2026 Maicarons

---

🇺🇸 English version: [README.md](./README.md).
