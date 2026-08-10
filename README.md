# voxel-tool

[![CI](https://github.com/Maicarons/voxel-tool/actions/workflows/ci.yml/badge.svg)](https://github.com/Maicarons/voxel-tool/actions/workflows/ci.yml)
[![Docs](https://github.com/Maicarons/voxel-tool/actions/workflows/pages.yml/badge.svg)](https://maicarons.github.io/voxel-tool/)
[![npm](https://img.shields.io/badge/npm-%40voxel--tool%2Fcore-blue)](https://www.npmjs.com/org/voxel-tool)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

一套用于 **MagicaVoxel `.vox` 文件** 的 JavaScript 工具集：纯 JS 读写核心库 + 基于 Three.js 真实 3D 渲染的查看器组件，覆盖 **React / Vue / SolidJS / Preact / Svelte / Qwik** 六大框架。

- 📦 **`@voxel-tool/core`** — 纯 JS 核心库：`.vox` 读写、调色板、体素网格（`VoxelGrid`），Node 与浏览器通用，零运行时依赖。
- 🧩 **`@voxel-tool/viewer`** — 框架无关的 Three.js 查看器核心（`createVoxelViewer` + `buildVoxelGeometry`），所有框架组件都复用同一套渲染实现。
- ⚛️ **`@voxel-tool/react`** — React 3D 查看器组件。
- 🟢 **`@voxel-tool/vue`** — Vue 3 3D 查看器组件。
- 🔵 **`@voxel-tool/solid`** — SolidJS 3D 查看器组件。
- 🟡 **`@voxel-tool/preact`** — Preact 3D 查看器组件。
- 🧡 **`@voxel-tool/svelte`** — Svelte 5 3D 查看器组件。
- 💜 **`@voxel-tool/qwik`** — Qwik 3D 查看器组件。

> 渲染原理参考主流 `.vox` viewer（MagicaVoxel / `threejs-vox-loader` / coding.kiwi 的 *Rendering .vox Files*）：每个体素是真实 3D 立方体，靠 WebGL 深度缓冲正确遮挡；只对暴露面生成几何（面剔除），把 6×N 个面砍到外壳，大模型也能秒渲。所有框架组件共享 `@voxel-tool/viewer` 同一份实现，不存在「每个框架重写一遍渲染」的重复代码。

---

## 仓库结构

```
voxel-tool/
├── packages/
│   ├── core/        @voxel-tool/core    纯 JS 核心库 (读写/调色板/网格)
│   ├── viewer/      @voxel-tool/viewer  框架无关查看器核心 (Three.js)
│   ├── react/       @voxel-tool/react   React 3D 查看器组件
│   ├── vue/         @voxel-tool/vue     Vue 3 3D 查看器组件
│   ├── solid/       @voxel-tool/solid   SolidJS 3D 查看器组件
│   ├── preact/      @voxel-tool/preact  Preact 3D 查看器组件
│   ├── svelte/      @voxel-tool/svelte  Svelte 5 3D 查看器组件
│   └── qwik/        @voxel-tool/qwik     Qwik 3D 查看器组件
├── docs/           VitePress 文档站点
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

## 文档

完整文档（安装、使用、API、组件示例、npm 发布方案）在线阅读：**https://maicarons.github.io/voxel-tool/**

源码在 **[docs/](docs/)**（VitePress）。

本地启动文档站点：

```bash
npm run docs:dev
```

## 发布到 npm

见 [PUBLISHING.md](PUBLISHING.md) 与 [docs/guide/publishing.md](docs/guide/publishing.md)。

## License

[MIT](LICENSE) © 2026 Maicarons
