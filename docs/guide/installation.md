# 安装

## 作为依赖使用

各包独立发布，按需安装：

```bash
# 核心库（读写 / 调色板 / 网格）
npm install @voxel-tool/core

# 框架无关查看器核心（各组件包都依赖它；直接用也行）
npm install @voxel-tool/viewer

# 框架组件（需对应 peer 依赖）
npm install @voxel-tool/react
npm install @voxel-tool/vue
npm install @voxel-tool/solid     # peer: solid-js
npm install @voxel-tool/preact    # peer: preact
npm install @voxel-tool/svelte    # peer: svelte ^5
npm install @voxel-tool/qwik      # peer: @builder.io/qwik
```

各包的 **peerDependencies**：

| 包 | peerDependencies |
|---|---|
| `@voxel-tool/core` | 无（零依赖） |
| `@voxel-tool/viewer` | 无（`three` 作为普通依赖） |
| `@voxel-tool/react` | `react` `^18 \|\| ^19`、`react-dom` `^18 \|\| ^19` |
| `@voxel-tool/vue` | `vue` `^3.3` |
| `@voxel-tool/solid` | `solid-js` `^1.8` |
| `@voxel-tool/preact` | `preact` `^10` |
| `@voxel-tool/svelte` | `svelte` `^5` |
| `@voxel-tool/qwik` | `@builder.io/qwik` `^1.5` |

`three` 作为普通 `dependency` 随查看器核心一起安装，组件包无需手动添加。

> Qwik 组件依赖 `@builder.io/qwik` 优化器：如果你的项目用 Vite，**必须在自身 Vite 配置里启用 `@builder.io/qwik/vite`**，否则本库导出的 QRL 无法被正确解析。

## 仓库本地开发（monorepo）

本仓库使用 **npm workspaces** 管理 `packages/*` 与 `docs`：

```bash
# 克隆后安装（会自动把三个包互相软链）
npm install

# 构建全部包（产物进入 packages/*/dist）
npm run build

# 运行全部包的测试
npm test

# 本地预览组件示例
npm run dev:react    # -> http://localhost:5173
npm run dev:vue      # -> http://localhost:5174
npm run dev:solid    # -> http://localhost:5176
npm run dev:preact   # -> http://localhost:5175
npm run dev:svelte   # -> http://localhost:5177
npm run dev:qwik     # -> http://localhost:5178

# 本地启动文档站点
npm run docs:dev
```

> 依赖安装、`npm run build` 等命令需 `NODE_OPTIONS=""` 以绕开部分沙箱环境的 safe-delete 拦截
> （仅本机特定环境需要，CI / 普通开发机通常无需）。
