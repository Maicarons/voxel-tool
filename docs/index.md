---
layout: home

hero:
  name: voxel-tool
  text: MagicaVoxel .vox 工具集
  tagline: 纯 JS 核心库 + Three.js 真实 3D 查看器（React / Vue）
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/installation
    - theme: alt
      text: API 参考
      link: /api/core
  features:
    - title: 零依赖核心库
      details: '@voxel-tool/core 纯 JS 读写 .vox、调色板与体素网格，Node / 浏览器通用，无运行时依赖。'
    - title: 真 3D 渲染
      details: 每个体素是真实立方体，WebGL 深度缓冲正确遮挡；面剔除把 6×N 个面砍到外壳，大模型也能秒渲。
    - title: React / Vue 组件
      details: 开箱即用的 <code>VoxViewer</code> 组件，拖拽旋转 / 滚轮缩放 / 右键平移。

---

## 这是什么？

**voxel-tool** 是一套用于 [MagicaVoxel](https://ephtracy.github.io/) `.vox` 体素模型的 JavaScript 工具集：

- **`@voxel-tool/core`** — 纯 JS 核心库：`.vox` 文件读写、调色板工具、`VoxelGrid` 体素容器。
- **`@voxel-tool/react`** — React 3D 查看器组件（基于 Three.js）。
- **`@voxel-tool/vue`** — Vue 3 3D 查看器组件（同一套渲染原理）。

渲染采用主流 `.vox` viewer 的原理：真实 3D 立方体 + 深度缓冲 + 面剔除 + 正交等距相机 + OrbitControls，
告别 Canvas 2D 画家算法的排序瑕疵。

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
