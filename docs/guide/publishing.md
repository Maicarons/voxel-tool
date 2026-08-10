# Publishing to npm

This page lays out the complete workflow for publishing the `voxel-tool` packages to npm. It follows the npm official docs and the latest 2025–2026 practice
(**the classic long-lived `NPM_TOKEN` has been revoked**; the modern approach is npm Trusted Publishing via GitHub OIDC).

## 1. Prerequisites: npm account and 2FA

- Register an account at [npmjs.com](https://www.npmjs.com/).
- **Enable two-factor authentication (2FA)**: WebAuthn / passkeys are recommended.
  > Since 2023, all **new packages require 2FA by default**; since 2025, publishing any package (new or existing) requires a 2FA check during the session.
- `npm login` now creates a **2-hour session token** (not shown in the UI, auto-expires, cannot be reused in CI).

Scoped packages (e.g. `@voxel-tool/core`) are **private by default**, and a free account cannot publish private packages,
so **the first publish must use** `--access public`. Later versions inherit the access level.

## 2. Publishing-related `package.json` fields (already configured in this repo)

| Field | Role | This repo |
|---|---|---|
| `name` | Package name, including scope | `@voxel-tool/core`, etc. |
| `version` | Semantic version | `0.1.0` |
| `type: "module"` | ESM-first | yes |
| `main` / `module` | Entry point | `dist/index.js` |
| `exports` | Resolution entry (ESM) | `".": "./dist/index.js"` |
| `files` | Publish only these dirs | `["dist"]` (no src / test) |
| `publishConfig.access` | First public publish | `"public"` |
| `peerDependencies` | Framework provided by the host | react / vue |
| `repository` / `homepage` / `bugs` | Source association | point to GitHub |
| `engines.node` | Minimum Node version | `>=18` |

> The pure-JS core uses `esbuild` to bundle into `dist/index.js`; React/Vue use Vite `lib` mode into `dist/`.
> None ships `.d.ts` (common for pure-JS libs); add types later if needed.

## 3. First local publish

```bash
# 1) Log in (2-hour session; 2FA is required at publish time)
npm login

# 2) Install and build all packages
npm install
npm run build

# 3) Dry-run before publishing to check "which files will be packed"
npm pack --dry-run -w @voxel-tool/core
# Should only show dist/ plus package.json, README, LICENSE — no src/ or node_modules/

# 4) Publish in order (components depend on core / viewer: core first, then viewer, then framework components)
npm publish -w @voxel-tool/core    --access public
npm publish -w @voxel-tool/viewer  --access public
npm publish -w @voxel-tool/react   --access public
npm publish -w @voxel-tool/vue     --access public
npm publish -w @voxel-tool/solid   --access public
npm publish -w @voxel-tool/preact  --access public
npm publish -w @voxel-tool/svelte  --access public
npm publish -w @voxel-tool/qwik    --access public
```

> One-shot script: after `build` in the root `package.json`, publish the workspaces in order.

## 4. Verify the published contents

Always run `npm pack --dry-run` before publishing to confirm the `files` field works:

```bash
npm pack --dry-run -w @voxel-tool/react
# Expected: only dist/index.js (+ maybe style), package.json, README.md, LICENSE
```

If `src/` or `node_modules/` shows up, the `files` config is wrong and must be fixed.

## 5. CI auto-publish (recommended: Trusted Publishing, tokenless)

The modern approach is **npm Trusted Publishing**: GitHub Actions proves its identity to npm via OIDC,
and npm issues a short-lived token automatically — **no token needs to be stored in the repo**.

### 5.1 Register a "Trusted Publisher" on the npm side

For each package (or the whole scope):

1. Log in to npm → open the package's (or scope's) **Settings → Publishing access**.
2. Add a **Trusted Publisher** with:
   - GitHub repository: `Maicarons/voxel-tool`
   - Workflow file name: `publish.yml`
   - Environment (optional)
3. Save.

> Trusted Publishing can be registered **before** the package's first publish; npm matches the package name via the OIDC assertion and creates the package.

### 5.2 Workflow (already provided as `.github/workflows/publish.yml`)

```yaml
name: Publish to npm
on:
  release:
    types: [published]
permissions:
  contents: read
  id-token: write   # for npm Trusted Publishing (OIDC); no NPM_TOKEN needed
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

Trigger: create a **Release** on GitHub (tag + publish) and CI publishes all eight packages automatically.
`--provenance` generates a supply-chain provenance attestation (needs OIDC, which pairs naturally with Trusted Publishing).

## 6. Alternative: Granular Access Token (GAT)

If OIDC is unavailable (e.g. self-hosted runners), use a **Granular Access Token**:

```bash
npm token create --granular --package "@voxel-tool/core" --permissions publish --bypass-2fa --expiry 30d
```

- You must check **Bypass 2FA** at creation, and it **expires within 90 days**.
- Store it as the repo Secret `NPM_TOKEN`, and reference it in `publish.yml` via `env.NODE_AUTH_TOKEN`.
- The classic long-lived token has been revoked — **do not** use the old `NPM_TOKEN` long-lived approach.

## 7. Versions and publish order

- Keep all eight packages on the same version (monorepo convention).
- Publish order: `core` first, then `viewer` (framework components depend on it), then `react` / `vue` / `solid` / `preact` / `svelte` / `qwik`, to avoid consumers installing incompatible versions.
- Bump version: `npm version patch/minor/major -w <pkg>`, commit and tag, then create a Release.

## 8. FAQ

- **`E402 must use --access public`**: a scoped package's first publish forgot `--access public` (this repo's `publishConfig` covers it).
- **`E404` / 2FA error**: the session token expired or 2FA wasn't passed; run `npm login` again.
- **`npm publish` stuck at 2FA**: a local publish must complete the 2FA challenge within the 2-hour session after `npm login`.
- **CI reports no permission to publish**: check that the Trusted Publisher is registered on the npm side and `permissions.id-token: write` is set.

Quick reference: [PUBLISHING.md](https://github.com/Maicarons/voxel-tool/blob/main/PUBLISHING.md).
