# 发布到 npm 的方案（速查）

完整文档见 **[docs/guide/publishing.md](docs/guide/publishing.md)**。

> ⚠️ 2026 规则速记：
> - 经典长期 `NPM_TOKEN` 已被吊销。CI 用 GitHub OIDC 可信发布（tokenless）；本地用 `npm login`（2 小时会话 + 2FA）。
> - **npm 现在默认走「分阶段发布（Staged Publishing）」**：`npm publish` 不再直接上架，而是先进入 staging 区，维护者用 2FA 审核通过（`npm stage approve`）后才真正公开。
> - 作用域包首次发布仍需 `--access public`。
> - 分阶段发布要求 **npm ≥ 11.15.0、Node ≥ 22.14.0**（否则没有 `npm stage` 命令）；本地机器先 `npm install -g npm@latest` 升级。

## 前置条件（本地机器）

- Node ≥ 22.14.0、npm ≥ 11.15.0（`npm --version` 检查，不够就 `npm install -g npm@latest`）。
- `npm login` 已完成（浏览器 + 2FA）。
- 已在 npmjs.com **拥有作用域 `@voxel-tool`**（Add a namespace）——「绑定 GitHub」只用于登录/2FA，不等于拥有作用域。
- 账户已开启 **2FA**。

## 本地发布流程

### 第 1 次：8 个包都是全新包 —— 必须先用普通 `npm publish` 创建

> 分阶段发布的硬性前提之一：**包必须已存在于 registry，全新包不能被 stage**。
> 所以首次发布只能用 `npm publish` 直接创建（创建即上架），无法走 `npm stage publish`。

```bash
npm install && npm run build

npm publish -w @voxel-tool/core    --access public
npm publish -w @voxel-tool/viewer  --access public
npm publish -w @voxel-tool/react   --access public
npm publish -w @voxel-tool/vue     --access public
npm publish -w @voxel-tool/solid   --access public
npm publish -w @voxel-tool/preact  --access public
npm publish -w @voxel-tool/svelte  --access public
npm publish -w @voxel-tool/qwik    --access public
```

- 每条都会触发 2FA 验证。顺序很重要：先 `core` → `viewer`（框架组件都依赖它）→ 再 `react/vue/solid/preact/svelte/qwik`。
- 若你的账户/组织强制 staging，则 `npm publish` 后包会进入 staging，终端会给出 `<stage-id>`，按下方「审核并放行」处理即可（首次创建走的是普通发布白名单，一般直接上架）。
- 本地发布不会带 provenance（provenance 需要 CI 的 OIDC 环境）；想要 provenance 走下面的 CI 方案。

### 第 2 次起：用分阶段发布（推荐，多一道审核）

```bash
# 1) 升版本号（按需选 patch / minor / major）
npm version patch -w @voxel-tool/core
# 2) 版本号改动要进 git
git add -A && git commit -m "chore: bump @voxel-tool/core"
# 3) 重新构建并 stage 发布
npm run build
npm stage publish -w @voxel-tool/core
# 4) 审核并放行（必须 2FA）
npm stage list                        # 列出待审核的包
npm stage approve <stage-id> --2fa    # 或去 npmjs.com 的 Staged Packages 页点 Approve
```

也可在 npmjs.com 的 **Staged Packages** 标签页查看 tarball、点 **Approve**（同样要 2FA）。8 个包逐个 `npm stage publish` 后，逐个 `npm stage approve`。

## 验证

- 包页面：`https://www.npmjs.com/package/@voxel-tool/core`（及其余 7 个）显示最新版本即成功。
- `npm stage list` 为空 → 全部放行完毕。

## CI 自动发布（备选，tokenless，带 provenance）

- 在 npm 侧为每个包登记 **Trusted Publisher**（仓库 `Maicarons/voxel-tool`，工作流 `publish.yml`），打 GitHub Release 触发 `.github/workflows/publish.yml`。
- 若想保留「分阶段审核」：把 workflow 里的 `npm publish ... --provenance` 改为 `npm stage publish ... --provenance`，发布后仍需你手动 `npm stage approve` + 2FA（CI 无法代替输入 2FA）。
- 各包 `package.json` 已设 `publishConfig.access = "public"`，`files` 仅含 `dist`，确保只发布构建产物。

> Qwik 组件依赖 `@builder.io/qwik` 优化器：消费端项目需在自身 Vite 配置启用 `@builder.io/qwik/vite`，否则导出的 QRL 无法被正确解析。
