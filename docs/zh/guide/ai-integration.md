# AI 集成（项目级技能）

voxel-tool 在 [`.workbuddy/skills/`](https://github.com/Maicarons/voxel-tool/tree/main/.workbuddy/skills) 内置了一套**项目级 WorkBuddy 技能**。它们随仓库提交，任何打开本项目的 AI 助手（或任何使用 WorkBuddy 的人）都能直接调用 voxel-tool——无需额外安装，也无需翻文档找参数。

## 为什么

与其每次都重新推导 CLI 参数和 API 签名，AI 直接加载对应技能即可拿到开箱即用的命令、准确的函数签名，以及我们早已发现的坑（例如 Draco 压缩的 GLB 不能被本 CLI 逆向体素化）。

## 技能清单

| 技能 | 触发语 | 覆盖内容 |
|------|--------|----------|
| `voxel-tool` | "这个项目能做什么"、"用 AI 调用这个项目" | **路由** —— 包结构表 + 决策表，指向正确的子技能。 |
| `voxel-export` | "把 .vox 转成 glb"、"体素化这个网格"、"用 draco 压缩" | 无头 `voxel-export` CLI：`.vox`/`.schem` ↔ GLB/glTF/OBJ/STL/PLY/USDZ/FBX、逆向体素化、Draco。 |
| `voxel-csg` | "合并两个 .vox"、"从 a 减掉 b"、"挖个洞" | 布尔并 / 交 / 差（CLI + `voxelCSG` API）。 |
| `voxel-schematic` | "导出成 minecraft schematic"、"导入 .schem" | Minecraft `.schem` ↔ GLB/VOX 往返（CLI + `parseSchematic`/`voxelToSchematic`）。 |
| `voxel-core` | "在 node 里读这个 .vox"、"用代码写个 vox"、"数一下体素数" | 编程式 `.vox` 读写：`parseVox`、`toVoxBytesScene`、`VoxelGrid`、`voxelizeMesh`、调色板。 |
| `voxel-viewer` | "展示这个 vox"、"在 react 里渲染 vox"、"嵌一个查看器" | `createVoxelViewer` + React/Vue/Solid/Preact/Svelte/Qwik 的 `VoxViewer`。 |

## 该用哪个技能

- 想要**一行命令**完成转换 → `voxel-export` 或 `voxel-csg`。
- 想要**写脚本**操作体素数据 → `voxel-core`（Node 直接 import）。
- 想要在**浏览器里展示**模型 → `voxel-viewer`。
- 拿不准 → 先加载 `voxel-tool`（路由技能）告诉你。

## 示例提问

> "把 `models/castle.vox` 转成 Draco 压缩的 GLB。"
> → `voxel-export` → `node packages/cli/bin/voxel-export.mjs models/castle.vox -d`

> "合并 `a.vox` 和 `b.vox`，重叠处用 b 的颜色。"
> → `voxel-csg` → `node packages/cli/bin/voxel-csg.mjs union a.vox b.vox --tie b`

> "用 Node 读 `ship.vox`，数一下有多少体素用了调色板索引 12。"
> → `voxel-core` → `parseVox` + `VoxelGrid`/`grid.list()` 过滤。

> "在 480×480 的 React 页面里渲染 `hero.vox`。"
> → `voxel-viewer` → `@voxel-tool/react` 的 `<VoxViewer src={bytes} width={480} height={480} />`。

> "把这个 `.vox` 变成能粘进 WorldEdit 的 Minecraft `.schem`。"
> → `voxel-schematic` → `voxel-export ... -f schem`

## 说明

- CLI 与 core 是**无头**的（Node ≥ 18，无需浏览器）；查看器**仅浏览器运行**（WebGPU 默认，回退 WebGL2）。
- 仓库内运行 CLI 请在根目录：`node packages/cli/bin/<cmd>.mjs <参数>`。
- 完整签名与六框架组件片段，技能内部引用 `references/api-reference.md` 与 `references/components.md`（按需读取）。
