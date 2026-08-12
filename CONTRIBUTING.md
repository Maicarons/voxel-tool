# 贡献指南

感谢你考虑为 **voxel-tool** 做贡献！

## 开发环境

```bash
npm install        # 安装所有 workspace 依赖
npm run build      # 构建全部包
npm test           # 运行全部包的测试
```

## 本地预览组件

```bash
npm run dev:react  # React 示例 -> http://localhost:5173
npm run dev:vue    # Vue 示例   -> http://localhost:5174
```

## 文档站点

```bash
npm run docs:dev   # VitePress 本地开发
```

## 提交规范

- 分支：`main` 受保护，请基于 `main` 开 `feature/xxx` 分支并发 PR。
- 包结构：核心逻辑放 `packages/core`，React 组件放 `packages/react`，Vue 组件放 `packages/vue`。
- 新增功能请同步更新 `docs/` 对应文档与示例。
- 提交 PR 前确保 `npm run build && npm test` 通过。

