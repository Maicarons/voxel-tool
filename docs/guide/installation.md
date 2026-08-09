# 安装

## 作为依赖使用

各包独立发布，按需安装：

```bash
# 核心库（读写 / 调色板 / 网格）
npm install @voxel-tool/core

# React 组件（需 peer: react / react-dom）
npm install @voxel-tool/react

# Vue 组件（需 peer: vue）
npm install @voxel-tool/vue
```

各包的 **peerDependencies**：

| 包 | peerDependencies |
|---|---|
| `@voxel-tool/core` | 无（零依赖） |
| `@voxel-tool/react` | `react` `^18 \|\| ^19`、`react-dom` `^18 \|\| ^19` |
| `@voxel-tool/vue` | `vue` `^3.3` |

`three` 作为普通 `dependency` 随组件包一起安装，无需手动添加。

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
npm run dev:react   # -> http://localhost:5173
npm run dev:vue     # -> http://localhost:5174

# 本地启动文档站点
npm run docs:dev
```

> 依赖安装、`npm run build` 等命令需 `NODE_OPTIONS=""` 以绕开部分沙箱环境的 safe-delete 拦截
> （仅本机特定环境需要，CI / 普通开发机通常无需）。
