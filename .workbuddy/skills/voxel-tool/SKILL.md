---
name: voxel-tool
description: >-
  Project-level overview and router for the voxel-tool monorepo. Use this skill
  first when a request relates to the voxel-tool project generally — to
  understand the repo layout, pick the right specialized skill, or discover what
  the toolbox can do — rather than a single narrow task. It points to the five
  specialized skills (voxel-export, voxel-csg, voxel-schematic, voxel-core,
  voxel-viewer) and summarizes when each applies. Also the entry point when the
  user says "use AI to call this project" / "what can this project do" / asks
  about the project's packages or capabilities.
agent_created: true
---

# voxel-tool — 项目总览与技能路由

voxel-tool 是一个 MagicaVoxel `.vox` 读写 + 3D 体素查看器 + 多框架组件 + CLI 的 monorepo（npm 作用域 `@voxel-tool`）。本 skill 是**入口地图**：帮你判断该用下面哪个专门 skill，以及项目整体能做什么。所有真实 API 细节都在子 skill 里——匹配到具体任务后，优先加载对应子 skill。

## 包结构 (monorepo)

| 包 | 作用 |
|----|------|
| `@voxel-tool/core` | 零依赖纯 JS `.vox` 读写 + `VoxelGrid` + 体素化 + CSG + schematic + 调色板 |
| `@voxel-tool/mesh` | 体素 → Three.js 几何体 / 材质 |
| `@voxel-tool/viewer` | 浏览器查看器 `createVoxelViewer`（WebGPU/WebGL2） |
| `@voxel-tool/exporter` | headless 导出 GLB/GLTF/OBJ/STL/PLY/USDZ/FBX + Draco |
| `@voxel-tool/react\|vue\|solid\|preact\|svelte\|qwik` | 各框架的 `VoxViewer` 组件 |
| `@voxel-tool/cli` | `voxel-export` / `voxel-csg` 命令行 |

Apps: `apps/vox-editor`（在线体素编辑器，Vite dev `:5180`）。Docs: `docs/`（VitePress，dev `:5173`，GitHub Pages base `/voxel-tool/`）。

## 选哪个 skill（决策表）

| 用户想做的事 | 用这个 skill |
|--------------|--------------|
| 把 `.vox`/`.schem` 转成 glb/obj/stl… 或把网格体素化回 `.vox`（命令行） | **voxel-export** |
| 合并 / 相交 / 相减（挖洞）两个体素模型 | **voxel-csg** |
| 与 Minecraft `.schem` 互转 / 往返 | **voxel-schematic** |
| 在 Node/浏览器里用代码读/写/构造 `.vox`、操作 `VoxelGrid`、`voxelizeMesh` | **voxel-core** |
| 在网页里渲染 `.vox`（vanilla 或 React/Vue/Solid/… 组件） | **voxel-viewer** |

## 快速判定

- 想要**命令行一行搞定** → `voxel-export` 或 `voxel-csg`（仓库内 `node packages/cli/bin/<cmd>.mjs ...`）。
- 想要**写代码/脚本**操作体素数据 → `voxel-core`（Node 直接 import）。
- 想要**在浏览器展示**模型 → `voxel-viewer`。
- 不确定具体哪个 → 先读本项目 `README.md` / `docs/`，或本 skill 的包结构表。

## 通用约束

- CLI 与 core 纯 headless（Node ≥ 18，无需浏览器）；viewer 必须浏览器（WebGPU 默认，回退 WebGL2）。
- 仓库内运行 CLI：`node packages/cli/bin/voxel-export.mjs <args>`（仓库根目录）。
- 已发现的真实限制（详见各子 skill）：Draco 压缩的 GLB 不能被本 CLI 逆向体素化（缺 DRACOLoader）；`.schem` 往返颜色有损；调色板索引 1..255（0 为透明哨兵）。

本 skill 刻意保持精简；具体 flags、函数签名、组件 props 见对应子 skill。
