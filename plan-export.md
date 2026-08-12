# 体素模型导出功能规划（OBJ / FBX / GLTF 等）

> 状态：**已实现** —— 独立包 `@voxel-tool/exporter`（v0.2.0），与 core/viewer/框架组件并列（同属 `@voxel-tool` 作用域）。
> 实现位置：`packages/exporter/{src,build,formats,index}.js` + `types/index.d.ts` + `test/exporter.test.mjs`。
> 相关代码：`packages/core`、`packages/viewer`、`apps/vox-editor`。
> 研究方向已从「在 viewer 内加 exporters.js」调整为「独立导出包」（用户要求独立成包，并与其他包同属 `@voxel-tool` 作用域）。

## 0. 架构演进：体素网格算法上提至 `@voxel-tool/mesh`（2026-08-12，P0 解耦）

> 原 `packages/viewer/src/mesh.js` 与 `packages/exporter/src/geometry.js` **逐行重复约 290 行**体素网格算法（FACES/NEIGHBORS、buildVoxelGeometry/BuildVoxelBuckets、整套 greedy meshing、emitGreedyQuads/appendGreedyQuad），唯二差异是顶点色（raw sRGB `col/255` vs sRGB→linear）与默认材质（Lambert/DoubleSide vs Standard/FrontSide）。现已抽为共享包 **`@voxel-tool/mesh`**（依赖 three + core），依赖顺序 `core → mesh → viewer/exporter`。

- **`packages/mesh/src/geometry.js`**：`buildVoxelGeometry` / `buildVoxelBuckets` / `buildVoxelGeometryGreedy` / `buildVoxelBucketsGreedy` / `makeMaterial` / `composeWorldMatrix`（实例变换 `R(rotation)·T(translation)` 也下沉至此，viewer 的 `worldMatrix` 与 exporter 的静态/动画变换改用它）。差异通过 `opts.colorSpace: 'raw' | 'linear'` 与 `opts.defaultMaterial: 'lambert' | 'standard'`、`opts.side` **参数化**，不再各写一份。
- **`packages/viewer/src/mesh.js`**：退化为 re-export `@voxel-tool/mesh` 的**薄转发壳**（默认 `colorSpace:'raw'` + Lambert/DoubleSide，等价原行为）。
- **`packages/exporter/src/geometry.js`**：退化为 re-export `@voxel-tool/mesh` 的薄转发壳；`build.js` 调用处显式传 `{ colorSpace: 'linear' }` 与 `{ defaultMaterial: 'standard', side: THREE.FrontSide }` 还原导出侧正确色彩/材质。
- 6 个框架包（react/vue/preact/solid/svelte/qwik）的 `buildVoxelGeometry` 本就 re-export 自 `@voxel-tool/viewer`，**完全未动**；其中 react/vue 原各有一份无引用的 `src/mesh.js` 转发壳，已删除（死代码）。
- 验证：typecheck 通过；viewer 13/13、exporter 27/27、cli 5/5、react 3/3、vue 3/3 测试全绿。

---

## 1. 可行性结论（TL;DR）

| 格式 | 可行性 | 实现路径 | 颜色/材质保真 |
|------|--------|----------|----------------|
| **GLTF / GLB** | ✅ 直接可用 | three 自带 `GLTFExporter` | 顶点色 + PBR（金属/粗糙/透明/自发光）最优 |
| **OBJ** | ✅ 直接可用 | three 自带 `OBJExporter` | **几何 only —— Three 的 OBJExporter 仅在 `Points` 路径写顶点色，`Mesh` 路径不写**，因此 OBJ 默认不带颜色（需颜色请用 GLB/PLY/USDZ/FBX） |
| **STL** | ✅ 直接可用 | three 自带 `STLExporter` | 无颜色（适合 3D 打印） |
| **PLY** | ✅ 直接可用 | three 自带 `PLYExporter` | 支持顶点色（点云/网格） |
| **FBX** | ⚠️ 需第三方 | three **不**内置；用 `@comfyorg/fbx-exporter-three` | 顶点色 + 变换可用；PBR 会被近似为 Lambert/Phong |

- `three@0.184` 已内置 `OBJExporter / GLTFExporter / PLYExporter / STLExporter / USDZExporter`（位于 `node_modules/three/examples/jsm/exporters/`），**只有 FBX 不在 three 里**。
- 我们的几何体已带 `position / normal / color` 顶点色、按材质分桶；`viewer` 的 `sceneRoot` 是带世界变换的 `Group` —— 直接喂给 three 导出器即可。
- `OBJExporter` 源码（第 214–231 行）确认：读 `geometry.getAttribute('color')`，写出 `v x y z r g b` 并 `convertLinearToSRGB()`，即**原生支持顶点色 OBJ**。
- FBX 第三方库（2025–2026 活跃）：`@comfyorg/fbx-exporter-three`（TS、仅依赖 fflate、peer three≥0.160、带 threejs/unity/unreal/blender/maya 预设）、`@fourthtemple/fbx-exporter`（零运行时依赖、`exportFbx()→Uint8Array`）、`@needle-tools/fbx-exporter`（较重，自带 result 结构）。**首选 `@comfyorg/fbx-exporter-three`**。

---

## 2. 现状梳理（现有代码资产）

- **`packages/core`**：只导出 `.vox`（`toVoxBytes` / `toVoxBytesScene` / `downloadVox`）。无 three 依赖，轻量。
- **`packages/viewer`**（依赖 three + `@voxel-tool/mesh`）：
  - `mesh.js` 现为 `@voxel-tool/mesh` 的**薄转发壳**：`buildVoxelGeometry` / `buildVoxelBuckets` 实际实现在共享包，默认 `colorSpace:'raw'`（= 旧 `col/255`）。
  - `viewer.js` 的 `sceneRoot`（`Group`，`rotation.x = -π/2`）是多实例 + 材质的世界变换根 —— 即导出时的现成对象。
- **`apps/vox-editor`**（React + three）：
  - `VoxelEditor`（`editor.ts`）用「**每体素一个 BoxGeometry + 每色一个 Lambert 材质**」，**无顶点色、无面剔除**；已有 `exportVox` / `exportPng`。
  - `Toolbar.tsx` 按钮通过 props 回调（`onSave` / `onExportPng`），`App.tsx` 接线。
  - 依赖：`@voxel-tool/core`、`three ^0.160.1`（注意：viewer 用 0.184，存在版本差，见风险）。

---

## 3. 设计方案（最终实现）

> 2026-08-11 调整：不再在 viewer 内部加 `exporters.js`，而是**独立成包 `@voxel-tool/exporter`**，与其他包同属 `@voxel-tool` 作用域。

### 3.1 独立包 `packages/exporter`

- `src/geometry.js`：现为 `@voxel-tool/mesh` 的**薄转发壳**；`build.js` 调用 `buildVoxel*` 时显式传 `opts.colorSpace: 'linear'` 做 sRGB→linear 顶点色修正（见 §4），默认材质 `MeshStandardMaterial` + `FrontSide`（对 GLTF/USDZ/FBX 保真更好，且 USDZ 不支持双面）。共享包才是算法唯一来源。
- `src/build.js`：`normalizeInput` + `buildExportObject` —— 把 VOX 解析结果 / 单模型 / 多实例统一装配成 **y-up 的 `THREE.Group`**（`rotation.x = -π/2`，与 viewer 对齐），每个实例按材质分桶成 Mesh 并施加 `R(rotation)·T(translation)` 世界变换。
- `src/formats.js`：`exportModel(object3d, format, options)` 调度 7 种格式；GLTF/OBJ/STL/PLY/USDZ 走 three 内置 exporter，FBX 走 `@comfyorg/fbx-exporter-three`（`parseSync(obj, { preset:'threejs', axisUp:'Y' })`）。另提供 `toBlob` / `toUint8Array` / `downloadModel` 辅助。
- `src/index.js`：`VoxelExporter` 类（`build` / `export` / `toBlob` / `download`）+ 上述函数再导出。
- `types/index.d.ts`：手写类型声明，复用 core 的 `RGBA` / `Material`。
- `test/exporter.test.mjs`：Vitest 覆盖 7 种格式魔数校验（glb=`glTF`、obj=`o/v/f`、stl=`solid`/DataView、ply=`ply`、usdz=`PK`、fbx=`Kaydara FBX Binary`）、面剔除、y-up 朝向、材质/多实例。Node 环境通过 `vitest.setup.mjs` 补齐 `FileReader` / `requestAnimationFrame` polyfill（three 的 GLTF/PLY exporter 需要）。

### 3.2 `viewer` / `editor` 接入（未做，后续可选）

- 若要在编辑器提供「导出模型」按钮，直接 `import { VoxelExporter } from '@voxel-tool/exporter'`，传 `grid.list()` + `palette` 即可，无需混合两套 three 的 Object3D。
- `apps/vox-editor` 的 `package.json` 增加 `@voxel-tool/exporter`（workspace `*`）。

---

## 4. 颜色保真（重要，必须做）

- 调色板是 **sRGB** 显示值；three 的顶点色属性默认按 **linear-sRGB** 解读。当前 `mesh.js` 直接把 `col/255` 写入 `color` 属性，会导致屏幕显示与导出都**偏亮**。
- 修正（已在 `@voxel-tool/exporter` 的 `geometry.js` 落地）：填充 `color` 属性前用 `THREE.Color().setRGB(r,g,b, THREE.SRGBColorSpace)` 做 sRGB→linear 转换。
  - `OBJExporter` 内部 `convertLinearToSRGB` → 导出的 OBJ 顶点色还原为原始调色板色（仅 Points 路径）。
  - `GLTFExporter` 以 linear 存文件、导入端转 sRGB → 也还原。
  - 屏幕显示同步修正为 WYSIWYG。
- 注：`@voxel-tool/viewer` 的 `buildVoxelGeometry` 经 `@voxel-tool/mesh` 共享包默认 `colorSpace:'raw'`（`col/255` 直接写）渲染，**行为与原 viewer 一致**；导出侧通过 `opts.colorSpace:'linear'` 走 sRGB→linear 修正（P0 解耦后两端共用同一实现、仅参数不同）。若要让 viewer 渲染也 WYSIWYG，只需在 viewer 侧改用 `colorSpace:'linear'`，无需重写算法。

---

## 5. 实施步骤（建议分 3 个阶段 / PR）

- **阶段 A — 核心 + 主力格式**
  - 写 `exporters.js`（glb/gltf/obj/stl/ply，纯 three）。
  - `mesh.js` 颜色 sRGB→linear 修正。
  - `viewer` 加 `export()`。
  - Vitest 单测：构造小体素 → 各格式 → 断言非空、GLB 有 `glTF` 头、OBJ 含 `v`+顶点色。
- **阶段 B — FBX**
  - 接入 `@comfyorg/fbx-exporter-three`（动态 import + `optionalDependencies`）。
  - viewer/editor 接线；Node 端把输出写文件，校验含 `Kaydara FBX Binary` 魔数、可被 FBXLoader 解析。
- **阶段 C — UI + 文档**
  - editor `Toolbar` 按钮 + `App` 接线（GLB/OBJ/FBX 默认，STL/PLY 可选）。
  - `docs/api/{viewer,core}.md` 与 `docs/zh/...` 增加「导出模型」章节。
  - （可选）`core` 纯文本 OBJ/STL **无 three** 写入器，供 headless / Node 管线使用。

---

## 6. 风险与取舍

1. **three 多实例**：editor 当前 `three ^0.160`，viewer 用 `0.184`。编辑器只传纯数据、在 viewer 的 three 内构建并导出 Object3D，规避对象混用冲突；但**建议把 editor 的 three 升到 0.184 与 viewer 对齐**（验证 `vite build` 通过）。
2. **FBX 是第三方、非 three 官方**：二进制格式闭源，保真度有限（Lambert/Phong；顶点色/变换可用；PBR 材质被近似）。规划里标注为「实验性」，并以 **GLB 作为保真首选**回退。
3. **OBJ 顶点色兼容性**：Blender 的 OBJ 导入对顶点色支持一般。如需稳妥颜色，预留「生成 `.mtl`（按材质分组的 `Kd`）」选项；默认走顶点色。
4. **导出几何规模**：编辑器当前每体素一个 cube（无面剔除）→ 直接导出的三角面数 = 体素数 × 12。阶段 A 默认用 `buildVoxelGeometry`（面剔除）重建几何体瘦身。

---

## 7. 验证方式

- **Vitest**：小体素 → `exportModel` 各格式 → 断言返回非空、GLB 有 `glTF` 头、OBJ 含 `v` 与顶点色、FBX 含 `Kaydara FBX Binary` 魔数。
- **手动**：editor 打开 demo 球体 → 点各导出按钮 → 在 Blender / Unity 打开，验证朝向（y-up  upright）与颜色。
- **CI**：现有 `ci.yml` 已含 typecheck/test，新增 vitest 用例即自动覆盖。

---

## 8. 待你确认的问题

1. 优先级：先做 **GLB/OBJ（阶段 A）** 就够，还是连 **FBX（阶段 B）** 一起排进同一轮？
2. editor 的 three 是否一并升到 0.184 对齐（推荐，但会动 editor 的 vite 构建）？
3. STL / PLY 是否要顺带支持（成本极低，three 已内置）？
4. 是否需要「无 three 的纯 core OBJ/STL 写入器」给 Node 管线用？
