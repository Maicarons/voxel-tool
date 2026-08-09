# 发布到 npm

本页整理将 `voxel-tool` 三个包发布到 npm 的完整方案。规则参考 npm 官方文档与 2025–2026 最新实践
（**经典长期 `NPM_TOKEN` 已被吊销**，现代做法为 GitHub OIDC「可信发布」）。

## 1. 前提：npm 账号与 2FA

- 在 [npmjs.com](https://www.npmjs.com/) 注册账号。
- **启用双因素认证（2FA）**：推荐 WebAuthn / 通行密钥（passkey）。
  > 自 2023 起所有**新包默认强制 2FA**；2025 起发布任意包（新旧）在会话期间都需 2FA 校验。
- `npm login` 现在会创建一个 **2 小时有效**的会话令牌（不显示在 UI、自动过期、不可在 CI 复用）。

作用域（scope）包（如 `@voxel-tool/core`）默认是 **private**，免费账号不能发布 private 包，
因此**首次发布必须** `--access public`。后续版本会继承访问级别。

## 2. package.json 发布相关配置（本仓库已配好）

| 字段 | 作用 | 本仓库设置 |
|---|---|---|
| `name` | 包名，含 scope | `@voxel-tool/core` 等 |
| `version` | 语义化版本 | `0.1.0` |
| `type: "module"` | ESM 优先 | 是 |
| `main` / `module` | 入口 | `dist/index.js` |
| `exports` | 解析入口（ESM） | `".": "./dist/index.js"` |
| `files` | 仅发布这些目录 | `["dist"]`（不含 src / test） |
| `publishConfig.access` | 首次公开发布 | `"public"` |
| `peerDependencies` | 框架由宿主提供 | react / vue |
| `repository` / `homepage` / `bugs` | 来源关联 | 指向 GitHub |
| `engines.node` | Node 版本下限 | `>=18` |

> 纯 JS 库（core）使用 `esbuild` 打包到 `dist/index.js`；React/Vue 用 Vite `lib` 构建到 `dist/`。
> 均未附带 `.d.ts`（纯 JS 库常见做法），如需类型可后续补充。

## 3. 本地首次发布

```bash
# 1) 登录（2 小时会话，发布时会要求 2FA 校验）
npm login

# 2) 安装并构建全部包
npm install
npm run build

# 3) 发布前先 dry-run 检查「哪些文件会被打进包」
npm pack --dry-run -w @voxel-tool/core
# 应只看到 dist/ 与 package.json、README、LICENSE，不应出现 src/ 或 node_modules/

# 4) 顺序发布（组件依赖 core / viewer，先发 core，再 viewer，最后各框架组件）
npm publish -w @voxel-tool/core    --access public
npm publish -w @voxel-tool/viewer  --access public
npm publish -w @voxel-tool/react   --access public
npm publish -w @voxel-tool/vue     --access public
npm publish -w @voxel-tool/solid   --access public
npm publish -w @voxel-tool/preact  --access public
npm publish -w @voxel-tool/svelte  --access public
npm publish -w @voxel-tool/qwik    --access public
```

> 一键脚本：根目录 `package.json` 的 `build` 后依次 publish 三个 workspace 即可。

## 4. 验证发布内容

发布前务必 `npm pack --dry-run` 检查 `files` 字段是否生效：

```bash
npm pack --dry-run -w @voxel-tool/react
# 预期: 仅包含 dist/index.js (+ 可能的 style)、package.json、README.md、LICENSE
```

若出现 `src/` 或 `node_modules/`，说明 `files` 配置有误，需修正。

## 5. CI 自动发布（推荐：Trusted Publishing，tokenless）

现代做法是 **npm Trusted Publishing**：通过 GitHub Actions 的 OIDC 身份向 npm 证明，
npm 自动签发短期凭证，**无需在仓库里存储任何令牌**。

### 5.1 在 npm 侧登记「可信发布者」

对每个包（或整个 scope）：

1. 登录 npm → 进入包（或 scope）的 **Settings → Publishing access**。
2. 添加 **Trusted Publisher**，填写：
   - GitHub 仓库：`Maicarons/voxel-tool`
   - 工作流文件名：`publish.yml`
   - 环境（可选）
3. 保存。

> 可信发布可在包**首次发布前**登记；npm 会按 OIDC 断言匹配包名并创建包。

### 5.2 工作流（本仓库已提供 `.github/workflows/publish.yml`）

```yaml
name: Publish to npm
on:
  release:
    types: [published]
permissions:
  contents: read
  id-token: write   # 供 npm Trusted Publishing (OIDC) 使用，无需 NPM_TOKEN
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
          registry-url: https://registry.npmjs.org
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: npm publish -w @voxel-tool/core --provenance --access public
      - run: npm publish -w @voxel-tool/viewer --provenance --access public
      - run: npm publish -w @voxel-tool/react --provenance --access public
      - run: npm publish -w @voxel-tool/vue --provenance --access public
      - run: npm publish -w @voxel-tool/solid --provenance --access public
      - run: npm publish -w @voxel-tool/preact --provenance --access public
      - run: npm publish -w @voxel-tool/svelte --provenance --access public
      - run: npm publish -w @voxel-tool/qwik --provenance --access public
```

触发方式：在 GitHub 创建 **Release**（打 tag + 发布），CI 自动发布全部八个包。
`--provenance` 会生成供应链溯源证明（需 OIDC，与可信发布天然契合）。

## 6. 备选：粒度访问令牌（GAT）

若无法使用 OIDC（如自托管 Runner），可用 **Granular Access Token**：

```bash
npm token create --granular --package "@voxel-tool/core" --permissions publish --bypass-2fa --expiry 30d
```

- 必须在创建时勾选 **Bypass 2FA**，且 **90 天内过期**。
- 存入仓库 Secret `NPM_TOKEN`，并在 `publish.yml` 中通过 `env.NODE_AUTH_TOKEN` 引用该 Secret。
- 经典长期令牌已被吊销，**不要**再用旧教程的 `NPM_TOKEN` 长期方案。

## 7. 版本与发版顺序

- 八个包版本建议保持同步（monorepo 惯例）。
- 发布顺序：先 `core`，再 `viewer`（框架组件都依赖它），最后 `react` / `vue` / `solid` / `preact` / `svelte` / `qwik`，避免消费者装到不兼容版本。
- 升级版本：`npm version patch/minor/major -w <pkg>`，提交并打 tag，再发 Release。

## 8. 常见问题

- **`E402 must use --access public`**：作用域包首次发布忘记 `--access public`（本仓库 `publishConfig` 已兜底）。
- **`E404` / 2FA 报错**：会话令牌过期或 2FA 未通过，重新 `npm login`。
- **`npm publish` 卡在 2FA**：本地发布需在 `npm login` 后的 2 小时会话内完成 2FA 挑战。
- **CI 报无权限发布**：检查 npm 侧是否登记了 Trusted Publisher，且 `permissions.id-token: write` 已加。

速查见仓库根 [PUBLISHING.md](https://github.com/Maicarons/voxel-tool/blob/main/PUBLISHING.md)。
