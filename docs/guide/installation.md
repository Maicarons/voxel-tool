# Installation

## Use as a dependency

Each package is published independently — install only what you need:

```bash
# Core library (read/write / palettes / grid)
npm install @voxel-tool/core

# Framework-agnostic viewer core (depended on by every component package; also usable on its own)
npm install @voxel-tool/viewer

# Framework components (require the matching peer dependency)
npm install @voxel-tool/react
npm install @voxel-tool/vue
npm install @voxel-tool/solid     # peer: solid-js
npm install @voxel-tool/preact    # peer: preact
npm install @voxel-tool/svelte    # peer: svelte ^5
npm install @voxel-tool/qwik      # peer: @builder.io/qwik
```

**peerDependencies** for each package:

| Package | peerDependencies |
|---|---|
| `@voxel-tool/core` | None (zero-dependency) |
| `@voxel-tool/viewer` | None (`three` is a regular dependency) |
| `@voxel-tool/react` | `react` `^18 \|\| ^19`, `react-dom` `^18 \|\| ^19` |
| `@voxel-tool/vue` | `vue` `^3.3` |
| `@voxel-tool/solid` | `solid-js` `^1.8` |
| `@voxel-tool/preact` | `preact` `^10` |
| `@voxel-tool/svelte` | `svelte` `^5` |
| `@voxel-tool/qwik` | `@builder.io/qwik` `^1.5` |

`three` is installed as a regular `dependency` alongside the viewer core, so component packages don't need to add it manually.

> The Qwik component depends on the `@builder.io/qwik` optimizer: if your project uses Vite, **you must enable `@builder.io/qwik/vite` in your own Vite config**, otherwise the QRLs exported by this library cannot be resolved correctly.

## Local development (monorepo)

The repository uses **npm workspaces** to manage `packages/*` and `docs`:

```bash
# Install after cloning (auto-links the packages to each other)
npm install

# Build all packages (output goes to packages/*/dist)
npm run build

# Run the tests for all packages
npm test

# Preview the component examples locally
npm run dev:react    # -> http://localhost:5173
npm run dev:vue      # -> http://localhost:5174
npm run dev:solid    # -> http://localhost:5176
npm run dev:preact   # -> http://localhost:5175
npm run dev:svelte   # -> http://localhost:5177
npm run dev:qwik     # -> http://localhost:5178

# Start the documentation site locally
npm run docs:dev
```

> Dependency installation, `npm run build`, etc. may need `NODE_OPTIONS=""` to avoid the safe-delete interception in some sandbox environments
> (only needed on specific machines; CI / normal dev machines usually don't require it).
