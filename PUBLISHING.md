# 发布到 npm 的方案（速查）

完整文档见 **[docs/guide/publishing.md](docs/guide/publishing.md)**。

> ⚠️ 2026 规则：经典长期 `NPM_TOKEN` 已被吊销。CI 自动发布请用 **GitHub OIDC 可信发布（tokenless）**，
> 本地发布用 `npm login`（2 小时会话 + 2FA）。作用域包首次发布仍需 `--access public`。

## 本地首次发布

```bash
npm login                                   # 2 小时会话, 发布时需 2FA
npm install && npm run build
npm pack --dry-run -w @voxel-tool/core      # 确认只打进 dist/
npm publish -w @voxel-tool/core    --access public
npm publish -w @voxel-tool/viewer  --access public
npm publish -w @voxel-tool/react   --access public
npm publish -w @voxel-tool/vue     --access public
npm publish -w @voxel-tool/solid   --access public
npm publish -w @voxel-tool/preact  --access public
npm publish -w @voxel-tool/svelte  --access public
npm publish -w @voxel-tool/qwik    --access public
```

## CI 自动发布（推荐，tokenless）

在 npm 侧为每个包登记 **Trusted Publisher**（GitHub 仓库 `Maicarons/voxel-tool`，工作流 `publish.yml`），
然后打 GitHub Release 即触发 `.github/workflows/publish.yml` 自动发布（无需 `NPM_TOKEN`）。

- 各包 `package.json` 已设 `publishConfig.access = "public"`。
- 各包 `files` 仅含 `dist`，确保只发布构建产物。
- 发版顺序：先 `core`，再 `viewer`（框架组件都依赖它），最后 `react` / `vue` / `solid` / `preact` / `svelte` / `qwik`。

> Qwik 组件依赖 `@builder.io/qwik` 优化器：消费端项目需在自身 Vite 配置启用 `@builder.io/qwik/vite`，否则导出的 QRL 无法被正确解析。
