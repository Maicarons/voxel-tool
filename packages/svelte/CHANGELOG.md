# @voxel-tool/svelte

## 0.3.0

### Minor Changes

- Add TypeScript type declarations (`types/index.d.ts`) for all framework viewer components, so TypeScript consumers now get full prop typing (`src`/`model`/`palette`/`background` and `width`+`height` or `size`). No runtime behavior change.

## 0.2.0

### Minor Changes

- ## 0.2.0 — 场景图 + 材质往返 + 类型与测试基建

  ### 核心 (`@voxel-tool/core`)

  - 新增 MagicaVoxel `.vox` **场景图**解析/写入：支持 `nTRN` / `nGRP` / `nSHP` 节点，保留平移 `_t`、旋转索引 `_r`、命名 `_name`、隐藏 `_hidden`。
  - 新增 **MATL 材质**解析与无损写回（`_metal` / `_rough` / `_alpha` / `_emit` / `_ior` 等仅在块内出现时才写出，保证往返字节一致）。
  - `parseVox` 现在始终返回 `scene`（旧式单模型自动合成为 identity 实例）与 `materials`。
  - 新增 `toVoxBytesScene({ models, scene, materials }, palette)` 导出，用于多模型 + 场景图 + 材质整体写回。
  - 导出 `ROTATION_MATRICES`（24 个带符号置换旋转矩阵）。

  ### 查看器 (`@voxel-tool/viewer`)

  - 几何改为体素局部空间（去掉内置 `rotateX(-π/2)`），由根 `Group` 统一做 z-up→y-up 变换。
  - 新增 `buildVoxelBuckets` 按调色板索引（材质）分桶；`makeMaterial` 对材质 id 0 用 `MeshLambertMaterial`，其余用 `MeshStandardMaterial`（金属度/粗糙度/透明度/自发光）。
  - `createVoxelViewer` 支持 `instances` 数组（平移/旋转/隐藏/命名），向下兼容旧的 `model`/`src`。

  ### 工程化

  - 为 `core` / `viewer` 补充 TypeScript 类型声明（`.d.ts`）+ `types` 字段。
  - 引入 Vitest 真测试，覆盖场景图 + 材质往返与几何分桶；修复 `core` 测试假阳性（之前不 `process.exit` 导致 CI 误绿）。
  - 引入 Changesets + Dependabot + CI 类型检查门。

### Patch Changes

- Updated dependencies
  - @voxel-tool/core@0.2.0
  - @voxel-tool/viewer@0.2.0
