# voxel-tool P4 升级路线图研究（2026-08-14）

> 状态：**研究中（待评审）**。P3 已全部发布（core 0.3.1 / mesh 0.1.0 / viewer 0.4.1 / exporter 0.4.2 / 框架 0.4.2 / cli 0.1.2，见 MEMORY.md「P3 功能路线图」）。本文件在 P3 基础上梳理 P4 的候选方向与优先级，供决策。
> 调研依据：项目内盘点（各 package.json、editor.ts、core parse/writer、mesh 几何算法）+ 外部调研（three.js r185 现状、体素工具生态 2026）。
> 本文结论由本机基于仓库现状与公开的 three.js / 体素生态资料整理，**未联网逐条核对版本号细节**，正式立项前对关键依赖版本做一次 `npm view` 复核即可。

---

## 0. 现状速览（P3 已交付 + 已完成的事实修正）

### 0.1 P3 已实现能力
- **CLI (P3.1)**：`.vox` → GLTF/GLB/OBJ/STL/PLY/USDZ/FBX，headless Node。
- **性能 (P3.2)**：greedy meshing（共享 `@voxel-tool/mesh`，naive→greedy 实心模型降 1000×+）。
- **渲染 (P3.2)**：viewer 支持 `renderer:'webgpu'`（动态 `import('three/webgpu')` 热替换，失败回退 WebGL），默认仍 WebGL。
- **格式/动画 (P3.3)**：`.vox` 无损往返（含 FRAM/nTRN `_f` 关键帧 + 嵌套 DICT）；体素动画导出（exporter 烘焙 glTF `AnimationClip`，已修 0.4.1 把动画当空数组覆盖的 bug）。

### 0.2 本次盘点修正的过时判断（重要）
- **`plan-export.md` §6 风险项「editor 的 three 是否升到 0.184」已解决**：`apps/vox-editor/package.json` 现用 `three@^0.184`，与 viewer/mesh 对齐。该 plan 的待确认项 2 已闭环。
- **core 已支持 MATL 材质块往返**：`parse.ts:174` 解析 `materials:{id→{metalness,roughness,alpha,emissive}}`，`writer.js:95` `matlChunk` 写回。
- **【2026-08-14 执行后修正】P4.1 实际已在 P3 阶段全部做完**，并非"未接入"：
  - `mesh/geometry.js` 的 `buildVoxelBuckets`/`makeMaterial` 早已按 `materials[v.i]` 分桶并套 metal/rough/alpha/emissive/ior；
  - `viewer.js` 的 `addInstance` 与 `exporter/build.js` 的 `buildExportObject` **都已把 core 解析的 `materials` 传进** `buildVoxelBucketsGreedy`+`makeMaterial`；CLI→`VoxelExporter`→GLB 会写进 `pbrMetallicRoughness`/`emissiveFactor`/`alphaMode BLEND`（新增测试已断言验证）。
  - **唯一真实遗留不一致**：viewer 调 `makeMaterial` 时没传 `defaultMaterial`，走默认 **Lambert**（不吃 metalness/emissive），而 exporter 用 **Standard**——同一个带 MATL 的模型"看"和"导出"的 PBR 表现不一致，且无 MATL 的纯顶点色体素在 viewer 里不吃金属/自发光。此点已在 2026-08-14 收尾：**viewer 默认材质改为 `Standard`**（保留 DoubleSide），与 exporter 对齐。P4.1 至此闭环。
- **编辑器渲染仍是「每体素一个 BoxGeometry + 每色一个 Lambert」**（`editor.ts:30` `SHARED_BOX`），无面剔除、无顶点色、无实例化。导出侧靠 `buildVoxelGeometry` 重建瘦身，但**编辑态本身的体素上限很低**，是真实性能债（见 P4.2）。
- **Schematic / Draco / KTX2 / voxelize / marching cubes 全仓均无**——确认是能力空白（见 P4.3 / P4.5）。

---

## 1. 外部调研要点

### 1.1 three.js 现状（2026）
- 当前主线已到 **r185**（项目用 r184，2026-03 的版本，差距很小）。
- **WebGPU 已"开箱即用 + 自动回退 WebGL2"**（自 r171）；Safari 26（2025-09）补齐最后一块拼图，**2026 年 WebGPU 已覆盖 100% 现代浏览器**。r184 重点做了**逐帧内存分配消除**（复杂场景帧率更稳）——对本项目的体素场景直接利好。
- **r185 破坏性变更**：废弃代码移除——`ShaderMaterial`/`RawShaderMaterial` 的纯 GLSL 不再自动转译（需 TSL 或 WGSL，否则强制 WebGL2 回退）；后处理 `PostProcessing` 类在 r183 已改名为 `RenderPipeline`（旧名会静默失败）。
  - **对本项目影响**：viewer 现在只用标准 `MeshStandardMaterial` + 顶点色，**不依赖自定义 GLSL**，因此 r184→r185 升级几乎无迁移成本。WebGPU 后端当前也只走标准材质，未碰 TSL/后处理，升级安全。
- **TSL（Three Shading Language）**：单源编译到 WGSL(WebGPU)+GLSL(WebGL)，2026 已成默认着色语言。本项目若要做自定义 AO/描边/自发光增强，应直接用 TSL 而非 GLSL（避免双维护）。

### 1.2 体素工具生态（2026）
- **MagicaVoxel**：仍是参照标准（免费、路径追踪渲染、调色板/笔刷/材质）。`.vox` 格式已支持场景图、调色板、MATL 材质、FRAM 动画——本项目 core 已覆盖其中绝大部分。
- **Goxel**：开源、跨平台、**稀疏矩阵（场景无限大）+ 图层非破坏式编辑**。其"稀疏存储"思路值得在超大模型场景借鉴。
- **Qubicle**：结构化管线**、布尔运算（减/交/并）体素建模**——本项目的体素编辑目前只有增/删/涂，缺布尔与高级编辑。
- **Minecraft / Schematic**：体素资产最常见的下游消费端之一；`.schem` / `.schematic` 互操作是明确的生态缺口。
- **互操作性（interoperability）是 2026 体素工具的决定性因素**：创作者按目的地（Blender / Unity / 3D 打印 / Minecraft）选导出格式——本项目 exporter 已覆盖主流网格格式，但缺游戏端（Schematic）与压缩（Draco/KTX2）。

---

## 2. P4 候选方向（按推荐优先级）

### P4.1 — PBR 材质全链路贯通 ★ P0 【2026-08-14 已完成】
- **执行结论（trust-but-verify 修正）**：经代码盘点，MATL→PBR 的网状实现**已在 P3 阶段全部落地**——`mesh/geometry.js` 的 `buildVoxelBuckets`/`makeMaterial` 按 `materials[v.i]` 分桶并套 PBR；`viewer.js`/`exporter/build.js` 都已把 core 的 `materials` 传入；CLI→GLB 会写进 `pbrMetallicRoughness`/`emissiveFactor`/`alphaMode BLEND`（新增测试断言验证通过）。原「PBR 被丢弃」是基于更早过时信息的误判。
- **本次仅做的真实收尾**：viewer 调 `makeMaterial` 时原本没传 `defaultMaterial`，走默认 **Lambert**（不吃 metalness/emissive），与 exporter 的 **Standard** 不一致。已改为 `defaultMaterial:'standard'`（保留 DoubleSide），消除"看/导出"PBR 表现不一致，且无 MATL 的纯顶点色体素也统一走 Standard。
- **改动文件**：`packages/viewer/src/viewer.js`（addInstance 的 makeMaterial 调用 + 文档注释）。
- **测试新增**：`exporter.test.mjs`（GLB 真实写进 PBR 节点）、`viewer.test.mjs`（默认材质 Standard）。
- **验证**：core 16/16、viewer 14/14、exporter 29/29、cli 5/5 全绿；typecheck 干净；拓扑序构建全仓通过。

### P4.2 — 编辑器渲染/编辑性能重构（每体素 Mesh → InstancedMesh 分组）★ P0/P1 ✅ **已完成（2026-08-14 执行）**
- **现状债**：`editor.ts` 每体素一个 `THREE.Mesh`（`SHARED_BOX` 虽共享几何体，但每个体素独立 Mesh = N 个 draw call + 拾取 `intersectObjects` 遍历 N 个 Mesh），编辑态体素上限极低。
- **实际做法（路线 B 变体，按颜色分组 InstancedMesh）**：没有走 greedy 重建（会丢失单体素拾取，且编辑器是交互式不必省三角面），而是**按调色板颜色分组**——每种颜色一个 `InstancedMesh`（单 draw call），draw call 从 N 降到"用到的颜色数"。保留单体素拾取：靠 `raycaster` 的 `instanceId` + 每组的 `coordMap`（instanceId→`x,y,z` key）反查坐标；增量编辑（paint/erase）只标脏对应颜色组并整组重建（单组通常很小）。全量重建（load/new/undo）先 `disposeInstances` 清旧模型残留再重建。
- **顺带**：`getMaterial` 从 `MeshLambertMaterial` 改为 `MeshStandardMaterial`（metalness 0 / roughness 0.9），与 P4.1 收尾（viewer/exporter 已 standard）对齐渲染语义，将来 editor 接 MATL 也直接兼容。
- **改动文件**：`apps/vox-editor/src/editor.ts`（`meshMap`→`instanceGroups`/`dirtyColors`、`rebuildMeshes`/`rebuildInstanceGroup`/`addVoxel`/`removeVoxel`/`disposeInstances`/`frameModel`/`onPointerUp`/`getMaterial` 全部改写 + 类型 `MeshStandardMaterial`）。
- **验证**：editor `tsc --noEmit` 干净；全仓拓扑序 `npm run build`（含 editor `vite build`）通过。⚠️ **editor 缺浏览器端测试基建**（实例化依赖 `WebGLRenderer`/`ResizeObserver`/`requestAnimationFrame`），本轮以 typecheck + 构建 + 静态逻辑核对验证；实际点击拾取需 Playwright/人工回归。
- **价值**：把编辑态 draw call 从 O(N) 降到 O(颜色数)，编辑器可承载规模级跃升，是与 MagicaVoxel/Goxel 竞争的关键可用性升级。

### P4.3 — 游戏端互操作：Minecraft Schematic 导入/导出 ★ P1 ✅ **2026-08-14 已完成并验证**
- **落地**：在 `@voxel-tool/core` 新增 `src/schematic.js`（零重依赖：手写 NBT 读写 + varint 编解码 + 跨平台 gzip），导出 `parseSchematic` / `voxelToSchematic` / `blockColor`。
  - `parseSchematic(bytes)`：Sponge v2 `.schem`（GZip+NBT）→ 兼容 `parseVox` 形状的体素数据（直接喂 viewer/exporter，故 `.schem → GLB/OBJ/...` 零改动）。
  - `voxelToSchematic(vox)`：体素数据 → Sponge v2 `.schem`（gzip NBT）；颜色经"最近 block"（欧氏距离）启发式近似回 Minecraft block 名（Minecraft 无颜色语义，只能近似）。
  - **规范精确点**：块排列 `index = x + z*Width + y*Width*Length`（X 最快 Y 最慢）、`BlockData` 为 **varint 打包**（非原始 int）、`Palette` 为 block-state 字符串→索引 Compound、`Width/Height/Length` 为 Short。
  - **跨平台 gzip**：只用 Web 标准 `CompressionStream`/`DecompressionStream`（Node18+/浏览器原生，互操作标准）；**不静态 import `node:zlib`**（否则 core 浏览器 bundle 构建失败，已踩坑修复）。
- **cli 挂载**：`voxel-export` 支持 `-f schem`（导出）与 `.schem` 输入（自动识别扩展名走 `parseSchematic`）；`.vox ↔ .schem` 双向 + `.schem → 任意通用格式` 全通。
- **验证**：core 测试 20/20（含手写最小 NBT + 手写 gzip `.schem` 字节解析块坐标/颜色 + round-trip）；cli 5/5；typecheck 干净；拓扑构建全绿；端到端 `sample.vox → .schem(1.2KB) → .glb(256KB)` 成功。
- **未做（留待后续）**：legacy MCEdit `.schematic`（数字 block id + YZX 原始字节数组，现代生态已弃用）；更精细的 block→颜色双向映射表（目前覆盖 ~50 个常用 block + 其余 hash 稳定灰）。

### P4.4 — 网格压缩：glTF-Draco 几何压缩 ★ P1 ✅ **2026-08-14 已完成并验证**
- **关键调研修正（trust-but-verify）**：three r185 的 `GLTFExporter` **根本不做几何 Draco 压缩**（grep 确认源码零 draco 引用，仅支持 KTX2 纹理压缩——而体素是顶点色/无纹理，KTX2 无意义）；原生 `DRACOExporter` 只产独立 `.drc`（丢材质/动画/层级），对体素项目不可用。因此**不能**靠 three 自带能力，必须走 **gltf-transform + draco3d 后处理** 这条路。
- **落地**：`packages/exporter/src/draco.js`（新增，`compressGlbDraco(input, opts)`）——用 `WebIO` + `KHRDracoMeshCompression`（手动 `document.createExtension(...).setRequired(true).setEncoderOptions({method, quantizationBits})` + `io.registerDependencies({'draco3d.encoder': await draco3d.createEncoderModule()})`）+ `io.writeBinary` 后对 GLB 做 `KHR_draco_mesh_compression` 后处理，保留 PBR 材质 + 烘焙动画。不依赖额外的 `@gltf-transform/functions` 包。
  - **动态 import 隔离**：`draco.js` 内部动态 `import('@gltf-transform/core'/'extensions'/'draco3d')`；`index.js` 用**动态 re-export 包装** `export async function compressGlbDraco(){ return (await import('./draco.js')).compressGlbDraco(...) }`——库的静态依赖图完全不含 draco，浏览器端（editor）构建不会把 draco3d(WASM) 打进主 bundle，也不触发 node:fs 的浏览器 external 警告；仅真调用时才按需加载。
  - **vite external 策略**：exporter 的 vite 把 `@gltf-transform/core`、`@gltf-transform/extensions`、`draco3d` 标为 external（与 three 一致，不打包重依赖，由消费端就近解析）；editor 的 vite 额外 `build.rollupOptions.external` + `optimizeDeps.exclude` 排除这三包，彻底消除 106KB 死 chunk。
  - **CLI**：`voxel-export` 加 `-d/--draco` 标志，导出 glb/gltf 时透传 `draco:true`；HELP 增加示例。
- **验证**：exporter 31/31（含 2 个 draco 测试：体积更小 + 含 `KHR_draco_mesh_compression`）、cli 6/6（含 draco 端到端）、core 20/20；typecheck 干净；全仓拓扑序 build 通过；**端到端 `sample.vox → .glb` 304,588B → `-d` 8,600B（压缩比 ~35×，远超预期 10×）**，且 primitive 的 POSITION/NORMAL/COLOR_0 均被 Draco 压缩、材质保留。
- **未做（留待后续）**：浏览器端 Draco **解码**需消费方配 `DRACOLoader`（导出端纯 Node/CLI 不需要，不在本项目范围）；KTX2 纹理压缩（体素无纹理，优先级低，暂不实现）。

### P4.5 — 逆向：mesh 体素化（mesh → .vox）★ P2 ✅ **2026-08-14 已完成并验证**
- **落地**：核心算法做成**无 three 依赖纯函数** `packages/core/src/voxelize.js` 的 `voxelizeMesh(triangles, options)`（可在 Node 直接单测，不放进编辑器），CLI 的 Node 端用 three loaders 把网格解析成三角形后调用。
  - **两种模式**：`shell`（默认，三角面 vs 体素 AABB 用 **SAT 13 轴**相交判定表面壳，不要求网格封闭）+ `solid`（逐体素中心沿 +X 射线 Möller–Trumbore 奇偶判定内部实心，需封闭流形）。
  - **颜色量化**：三角形顶点色/材质色平均 → 量化进调色板（覆盖用到的索引，超出 255 走最近匹配）。
  - **退化修复（trust-but-verify 踩坑）**：①solid 模式射线恰好压在共享棱/对称平面（实测单位立方体漏标对角线 64 个体素）→ 给射线垂直分量加非对称 epsilon jitter 打破退化，奇偶确定性收敛（solid 立方体 512/512 ✓）；②shell 模式三角形恰好落在体素边界（如 x=1 面）时 AABB→索引映射漏掉紧贴表面的壳层 → 端点做 epsilon 外扩让两侧相邻体素都进候选；③pad 语义=外围留空 margin，跳过最外 `pad` 圈避免 SAT 接触误标。
  - **CLI 逆向闭环**：`packages/cli/src/export.mjs` 加 `voxelizeModel(input, {resolution, mode, pad})`——GLB/GLTF/OBJ/STL 经 three `GLTFLoader`/`OBJLoader`/`STLLoader` 解析→`collectTriangles`(应用世界变换+提取顶点色)→`voxelizeMesh`→`toVoxBytes` 写 `.vox`。bin 入口按扩展名自动分流（`.glb/.gltf/.obj/.stl` → 逆向；其余 → 正向导出），加 `-r/--resolution`、`--solid`、`--pad` 选项 + HELP。
    - **GLTFLoader 坑**：`parse` 只接受 `string(.gltf)` 或 `ArrayBuffer(.glb)`，传 `Uint8Array` 会被误当 JSON 文本失败 → `.glb` 分支必须传 `raw.buffer.slice(...)`、`GLTF` 分支传文本。
- **验证**：core 36/36（含 voxelize 用例：shell 立方体 296 体素 / solid 512 / pad 网格+2 且壳不变 / 颜色量化 / 非正方形包围盒 / 退化平面 / 空输入报错）；cli 8/8（含 `sample.vox→glb→vox` 闭环 + 手写 STL→vox）；typecheck 干净；全仓拓扑序 build 通过；**端到端 `sample.vox→glb(304KB)→vox(分辨率48, 9166 体素, 37KB)`** 成功，形成"任意网格 → 体素 → 再创作"完整互操作回路。
- **未做（留待后续）**：marching cubes 提取等值面、LOD/抽稀后体素化、编辑器内"导入体素模型"按钮（CLI 已能产出 vox，编辑器加载已有 `parseVox` 路径，仅需加 UI 入口）。marching cubes 提取等值面、LOD/抽稀后体素化。

### P4.6 — 高级体素编辑（布尔/图层/对称/TSL）★ P2（探索性）✅ **2026-08-14 全部交付并验证**
- **方向**：参考 Qubicle 的布尔运算（并/交/差）、Goxel 的图层非破坏式编辑、MagicaVoxel 的对称笔刷 + 描边/自发光增强。
- **✅ 对称笔刷（P4.6 子集，2026-08-14 已交付）**：`mirrorCoordinates(x,y,z,size,symmetry)` 作为**纯几何工具**放进 `@voxel-tool/core/src/symmetry.js`（无 three 依赖、Node 直接单测），按开启轴生成所有镜像坐标（含原点、多轴 2^k、自动去重、越界由消费方裁剪）。editor 加 `symmetry` 状态 + `setSymmetry`/`toggleSymmetry`/`getSymmetry` + 私有 `applySymmetry`；拾取编辑末尾统一 `rebuildDirty`。Toolbar X/Y/Z 分段开关 + 底部提示。
  - **验证**：core 27/27（7 个 `mirrorCoordinates` 单测）；editor tsc + vite build 干净。
- **✅ 布尔 CSG（P4.6 余下，2026-08-14 已交付）**：`packages/core/src/csg.js` 的 `voxelCSG(a, b, op)`（`'union'|'intersection'|'difference'`）作为**无 three 纯函数**——把两个 `VoxelGrid` 的 `voxels` Map 做集合并/交/差（以坐标 key 为单位），可被 Node 直接单测。editor 加 `booleanOp(op, otherGrid)` 公开方法对**当前激活图层**做 CSG；UI 在 Toolbar 加"并/交/差"下拉 + "CSG 应用"按钮，触发隐藏 `<input type=file>` 载入第二个 `.vox`（`parseVox`→`VoxelGrid`→`booleanOp`）。CLI 新增 `voxel-csg` 子命令（或称 `voxel-export --csg` 形式）：两个 `.vox` 做布尔后导出。
  - **验证**：core 测试含 `voxelCSG` 用例（并/交/差 + 越界裁剪）；cli 端到端 `sample.vox` 与自身做 union/intersection/difference 往返；core 44/44、cli 11/11 全绿。
- **✅ 图层非破坏式编辑（P4.6 余下，2026-08-14 已交付）**：editor 内部模型从单一 `VoxelGrid` 改为 `EditorLayer[]`（`{id,name,visible,opacity,grid}`），绘制/擦除只作用于 `activeLayer`。公开 API：`addLayer/removeLayer/moveLayer/setLayerVisible/setLayerOpacity/setLayerName/setActiveLayer` + `getLayers()`；透明度/显隐**仅影响渲染**（合成用 `getCompositeGrid` 后写回，不改任何图层数据，撤销用全图层快照 `JSON.stringify`，非破坏）。UI 新增 `LayersPanel`（侧边栏）：增删/上下移/双击重命名/单击选中/眼睛显隐/不透明度滑块。导出（`exportVox`/`exportModel`）走 `getCompositeGrid`（可见层从上到下合并，后者覆盖前者）。
  - **验证**：editor tsc + vite build 干净；LayersPanel 已接入 App；撤销快照覆盖全部图层（含尺寸/可见/透明度）。⚠️ 同上，editor 缺浏览器端测试基建，以 typecheck+构建+静态核对验证；点击/拖拽拾取与图层交互需 Playwright/人工回归。
- **✅ 描边 / 自发光 TSL 增强（P4.6 余下，2026-08-14 已交付）**：`packages/mesh/src/tsl.js` 的 `applyVoxelTsl(material, opts)`——核心在 **TSL 与经典材质双路径**：
  - **NodeMaterial 路径**（WebGPU，`material.isNodeMaterial`）：用 `three/tsl` 的 `positionViewDirection`/`normalView`/`dot`/`abs`/`pow`/`float`/`vec3` 构建 **Fresnel 边缘描边**节点 `pow(1 - abs(dot(normalView, positionViewDirection)), power)`，加性挂到 `material.emissiveNode`；并按 `emissive`/`emissiveIntensity` 叠加自发光节点（纯 TSL，WGSL+GLSL 单源）。
  - **经典材质降级路径**（`MeshStandardMaterial`）：`applyVoxelTsl` 返回 `false`，由调用方把 `emissive` 降级为 `.emissive`/`.emissiveIntensity`（WebGL 无 Fresnel 描边，仅自发光生效）。
  - **依赖拆分关键**：TSL 节点来自 `three/tsl`（Node-safe 独立构建），经 `mesh/geometry.js` 的 `makeMaterial` 的 `nodeMaterialClass`/`tsl` 选项接入；exporter/CLI 永不 import `three/webgpu`，故不会把 WebGPU 渲染器打进 Node 路径。`three/webgpu` 仅由 viewer/editor 在**运行时动态 `import()`** 加载 `WebGPURenderer` + `MeshStandardNodeMaterial`。
  - **viewer 挂载**：`ViewerInstanceOptions` 加 `tsl?:{...}|null` + `onBackend?`；`addInstance` 在有 `nodeMaterialClass`（WebGPU）时建 NodeMaterial 并 `applyVoxelTsl`。**editor 挂载**：`EditorOptions.tsl` + `setTsl(opts|null)` 动态切换；`getMaterial` 在 `backend==='webgpu' && nodeMatClass` 时建 NodeMaterial 并挂 TSL，否则经典降级。UI 在 Toolbar 加"TSL 增强"按钮（仅 WebGPU 后端可用，WebGL 回退时禁用），App 加右上角 `backend-badge`（WebGPU/WebGL2）。
  - **验证**：mesh + exporter 重建 dist（含 `applyVoxelTsl`）；viewer 14/14、exporter 31/31 全绿；editor tsc + vite build 干净，且 `three.webgpu` 正确 code-split 为独立 673KB 动态 chunk。⚠️ TSL 视觉表现依赖 WebGPU 运行时，本机无浏览器实测基建，以类型/构建/静态核对验证；真实 Fresnel 辉光需 Playwright/人工在支持 WebGPU 的浏览器回归。

### P4.7 — three.js r185 升级 + WebGPU 生产化 ★ P1（维护性）✅ **2026-08-14 全部交付并验证**
- **【版本升级，2026-08-14 已完成】**：全仓 `three@^0.184` → `^0.185`（实际 0.185.1，含 `@types/three` 0.185.4），mesh/viewer/exporter/editor 四者同步对齐。r184→r185 对纯标准材质项目**零迁移成本**，typecheck/构建/测试全绿。
- **【WebGPU 生产化，2026-08-14 已完成】**：把 WebGPU 从"可选实验"提升为**默认后端**（保留 WebGL2 自动回退），落在 viewer 与 editor 两端：
  - **viewer**：`ViewerInstanceOptions.renderer` 默认值 `'webgl'` → **`'webgpu'`**；构造时同步建 WebGL 占位渲染器（保证布局/animate 立即可渲染），随后 `await import('three/webgpu')` 尝试 `WebGPURenderer` + `MeshStandardNodeMaterial`，成功则热替换（`currentBackend='webgpu'`、`nodeMatClass` 就绪、`onBackend?.('webgpu')`），失败/`navigator.gpu` 缺失则 `onBackend?.('webgl')` 保留 WebGL。两者都走 `afterBackendResolved()`：若有 `tsl` 待应用则重建材质。
  - **editor**：构造时同步建 WebGL 占位，随后 `initWebGPURenderer()` 异步尝试 `WebGPURenderer`，成功热替换渲染器 + `OrbitControls`（`backend='webgpu'`、`nodeMatClass=MeshStandardNodeMaterial`、`onBackend?.('webgpu')`），失败/`navigator.gpu` 缺失则 `backend='webgl'` + `onBackend?.('webgl')`。
  - **类型隔离（关键）**：WebGPU 类**只用 `import('three/webgpu')` 运行时动态加载**，类型面用结构化 `AnyRenderer`（render/setSize/setPixelRatio/getPixelRatio/domElement/dispose/renderAsync?）描述，避免编辑器类型图引入 `three/webgpu`（否则会把 WebGPU 渲染器编译进浏览器 bundle 依赖）。TSL 节点来自独立的 `three/tsl`（Node-safe），与 `three/webgpu` 物理隔离——exporter/CLI 永不触达 WebGPU 运行时。
  - **UI 指示**：editor App 右上角 `backend-badge`（WebGPU 绿 / WebGL2 黄），Toolbar "TSL 增强"按钮在非 WebGPU 后端自动禁用。
  - **验证**：editor vite build 产出独立动态 chunk `dist/assets/three.webgpu-*.js ~673KB`（确认 code-split + 动态加载生效），主场 chunk 1.5MB（仅 chunk-size 警告，非错误）；viewer/editor tsc + build 干净。⚠️ **浏览器实测回退路径本机无法自动化**（无浏览器基建）：fallback 逻辑已按 `navigator.gpu` 缺失 + try/catch 兜底实现，但"关 WebGPU 实测渲染"需在支持 WebGPU 的浏览器人工回归（待排期）。
- **成本**：低–中。
- **价值**：跟上主线、消除技术债、WebGPU 红利（逐帧零分配 + TSL 单源着色）落地为默认路径。

---

## 3. 推荐 P4 落地顺序（分阶段 / PR）

| 阶段 | 内容 | 优先级 | 预估成本 | 风险 | 状态 |
|------|------|--------|----------|------|------|
| **P4-A** | PBR 材质收尾（P4.1 viewer 默认改 Standard）+ three r185 升级（P4.7） | P0 | 低 | 低（纯标准材质，无 GLSL 迁移） | **✅ 2026-08-14 已完成** |
| **P4-B** | 编辑器性能重构（P4.2，路线 A 先行） | P0/P1 | 中 | 中（editor 主类重构） | 待排期 |
| **P4-C** | Schematic 互操作（P4.3）+ Draco 压缩（P4.4） | P1 | 中/低 | 中（NBT/GZip、调色板映射） | **✅ 2026-08-14 已完成** |
| **P4-D** | mesh 体素化（P4.5）+ 高级编辑（P4.6 对称/布尔/图层/TSL） | P2 | 高 | 高（探索性） | **✅ 全部完成** |

**首轮已交付（P4-A）**：P4.1 的网状实现经核实早在 P3 落地，本次仅收尾 viewer 默认材质（Lambert→Standard）消除看/导出不一致；并全仓 three `^0.184.0`→`^0.185.0`（实际 0.185.1，含 `@types/three` 0.185.4）对齐主线。下一步建议 P4-B（编辑器性能重构）。

**后续轮次已全部交付**：P4-B（编辑器 InstancedMesh 重构）→ P4-C（Schematic + Draco）→ P4-D（对称笔刷 + mesh 体素化 + **布尔 CSG + 图层非破坏式编辑 + TSL 描边/自发光**）→ P4.7（three r185 + **WebGPU 生产化：默认后端 + WebGL 回退 + TSL 单源着色**）。**P4 路线图至此全部闭环。**

**本轮（2026-08-14 收尾）交付清单**：
1. **P4.6 余下**：①布尔 CSG（`voxelCSG` 纯函数 + editor `booleanOp` + CLI `voxel-csg`）；②图层非破坏式编辑（`EditorLayer[]` + `LayersPanel`）；③描边/自发光 TSL 增强（`applyVoxelTsl` 双路径 + viewer/editor `tsl` 选项 + Toolbar 开关 + 后端徽标）。
2. **P4.7 生产化**：viewer/editor 默认 WebGPU 后端 + WebGL2 自动回退 + `onBackend` 回调 + 结构化 `AnyRenderer` 类型隔离；`three.webgpu` 动态 code-split。
3. **校验**：core 44/44、cli 11/11、viewer 14/14、exporter 31/31 全绿；根拓扑序 `npm run build`（含 docs + 6 框架包 + editor）通过；editor tsc 干净。

**遗留（待人工/Playwright 浏览器回归，本机无基建）**：editor 实例化拾取与图层/CSG/TSL 的实际交互、WebGPU→WebGL2 回退的视觉确认、TSL Fresnel 辉光真实渲染。CI（Node 22）可覆盖构建/类型/单测，但不能覆盖 WebGL/WebGPU 运行时渲染。

---

## 4. 跨方向的技术约束（沿用 P3 踩坑经验）

1. **构建顺序**：根 `build` 必须显式拓扑序 `core→mesh→viewer/exporter→框架→cli→docs→editor`（**禁用 `--workspaces` 字母序**，exporter(e) 会排在 mesh(m) 前导致 `Failed to resolve entry for @voxel-tool/mesh`）。任何新增跨包依赖后复查。
2. **Vite 版本**：全仓 Vite 7，VitePress 隔离 `vite@5.4.21`；**禁止根 `overrides:{vite:"^7"}`**（会强升 VitePress 的 vite 致 peer 冲突 / `Conflicting override sets`）。
3. **three 版本对齐**：mesh/viewer/exporter/editor 必须同一 three 大版本（当前 r184→P4 升 r185 时四者同步）。
4. **发布**：走 `publish.yml`（NPM_TOKEN + `--provenance`），发布后 `npm view $name@$ver` 校验（npm 最终一致性延迟，新 scoped 包首写延迟数分钟）；别只信客户端 `+` 输出。注意 npm 网页若配了 Trusted Publisher 会拦截 token 发布。
5. **测试**：Vitest 批量 `--workspaces` 偶发 flaky（Node25+vitest4），单包 `npx vitest run` 稳；CI 用 Node 22。测试别用 `execFile`/`spawn` 拉 three 的 bin 子进程。
6. **本地构建**：Windows 沙箱需 `NODE_OPTIONS=""` 前缀绕过 safe-delete shim；git push 走 `http.proxy=127.0.0.1:7890` + schannel；`gh` 保留代理 env。

---

## 5. 待你拍板的问题

1. ~~P4 首发是否就 P4-A（PBR 材质 + three r185）~~ **已执行并交付**。
2. ~~编辑器性能重构（P4.2）走 路线 A 还是 路线 B？~~ **已决定并执行：路线 B 变体——按调色板颜色分组 InstancedMesh**。
3. ~~Schematic（P4.3）与 Draco（P4.4）是否要排进同一轮~~ **已同一轮交付**。
4. ~~mesh 体素化（P4.5）/ 高级编辑（P4.6）作为探索性 P2，是否本轮先不碰？~~ **已全部交付（含 CSG/图层/TSL）**。
5. **WebGPU→WebGL2 回退 + TSL Fresnel 的实际浏览器渲染验证**能否排一次人工/Playwright 回归？（本机无浏览器基建，当前仅类型/构建/单测覆盖。）
6. **P4 全部完成后是否进入发布节奏**：用 changesets 提一个 P4 汇总 release（core/mesh/viewer/exporter/cli 版本号递进 + 框架包同步），走已有的 `publish.yml`（NPM_TOKEN + `--provenance`）+ Pages 部署 docs？
