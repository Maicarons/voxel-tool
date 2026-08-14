---
layout: home

hero:
  name: voxel-tool
  text: MagicaVoxel .vox 工具集
  tagline: 纯 JS 核心库 + Three.js 真实 3D 查看器（React / Vue / Solid / Preact / Svelte / Qwik）
  actions:
    - theme: brand
      text: 快速开始
      link: /zh/guide/installation
    - theme: alt
      text: API 参考
      link: /zh/api/core
  features:
    - title: 零依赖核心库
      details: '@voxel-tool/core 纯 JS 读写 .vox、调色板与体素网格，Node / 浏览器通用，无运行时依赖。'
    - title: 真 3D 渲染
      details: 每个体素是真实立方体，WebGL 深度缓冲正确遮挡；面剔除把 6×N 个面砍到外壳，大模型也能秒渲。
    - title: 动画与 .vox 往返
      details: '核心库解析并无损写回 MagicaVoxel 帧动画（FRAM + nTRN 关键帧）；导出器把运动烘焙成 glTF/GLB 动画片段，并可将任意模型原样写回 .vox。'
    - title: Greedy 合并 + WebGPU
      details: 'Greedy meshing 合并共面同色面，把实心模型的三角形数降低 1000× 以上；默认后端为 WebGPU（自动回退 WebGL2），且 WebGPU 代码按需拆分加载，仅在请求时下载。'
    - title: 编辑器、CSG 与互操作
      details: '浏览器体素编辑器支持非破坏式图层、布尔 CSG（并/交/差）、对称笔刷与 TSL 边缘/自发光增强；无头 CLI 可在 .vox 与 GLB/glTF/OBJ/STL/PLY/USDZ/FBX 间转换、把网格体素化、执行 CSG，并支持 Minecraft Schematic 往返。'
    - title: 六大框架组件
      details: 开箱即用的 <code>VoxViewer</code> 组件，覆盖 React / Vue / Solid / Preact / Svelte / Qwik，拖拽旋转 / 滚轮缩放 / 右键平移。

---

<div style="text-align:center">
  <img src="/media/voxel-tool-promo.gif" alt="voxel-tool — 60 秒项目演示" width="720"/>
</div>

## 这是什么？

**voxel-tool** 是一套用于 [MagicaVoxel](https://ephtracy.github.io/) `.vox` 体素模型的 JavaScript 工具集：

- **`@voxel-tool/core`** — 纯 JS 核心库：`.vox` 文件读写、调色板工具、`VoxelGrid` 体素容器。
- **`@voxel-tool/mesh`** — 共享体素几何核心 (Three.js)：面剔除 + greedy meshing 的 `buildVoxelGeometry` 单一实现，被 `@voxel-tool/viewer` 与 `@voxel-tool/exporter` 共用；颜色空间与材质差异通过参数表达。
- **`@voxel-tool/viewer`** — 框架无关的 Three.js 查看器核心（`createVoxelViewer` + `buildVoxelGeometry`），所有框架组件都复用它。
- **`@voxel-tool/exporter`** — 独立导出库：体素模型 → GLB / glTF / OBJ / STL / PLY / USDZ / FBX，并支持 `.vox` 无损往返与 glTF/GLB 动画烘焙。
- **`@voxel-tool/cli`** — 无头 Node CLI：`.vox` ↔ GLB/glTF/OBJ/STL/PLY/USDZ/FBX 双向转换、网格体素化、布尔 CSG，以及 Minecraft Schematic 往返——无需浏览器。
- **`@voxel-tool/react`** — React 3D 查看器组件（基于 Three.js）。
- **`@voxel-tool/vue`** — Vue 3 3D 查看器组件（同一套渲染原理）。
- **`@voxel-tool/solid`** — SolidJS 3D 查看器组件。
- **`@voxel-tool/preact`** — Preact 3D 查看器组件。
- **`@voxel-tool/svelte`** — Svelte 5 3D 查看器组件。
- **`@voxel-tool/qwik`** — Qwik 3D 查看器组件。

渲染采用主流 `.vox` viewer 的原理：真实 3D 立方体 + 深度缓冲 + 面剔除 + 正交等距相机 + OrbitControls，
告别 Canvas 2D 画家算法的排序瑕疵。所有框架组件共享 `@voxel-tool/viewer` 同一份实现，
不存在「每个框架重写一遍渲染」的重复代码。

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
