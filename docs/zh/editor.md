# 体素编辑器

功能完整的 **MagicaVoxel `.vox` 编辑器**，完全在浏览器中运行——加载、编辑、导出体素模型，无需安装任何软件。

<div class="editor-cta">
  <a href="/voxel-tool/editor/" target="_blank" rel="noopener noreferrer" class="cta-button">
    打开编辑器
  </a>
</div>

## 功能一览

| 功能 | 说明 |
|---|---|
| **打开 / 保存** | 支持任意 `.vox` 文件（MagicaVoxel 格式）；可保存回 `.vox` |
| **绘制模式** | 在 3D 画布上点击或拖拽放置体素（使用当前选中颜色） |
| **擦除模式** | 点击删除单个体素 |
| **调色板** | 完整的 MagicaVoxel 255 色调色板，点击选取颜色 |
| **撤销** | 撤销上一步操作（`Ctrl+Z`） |
| **网格开关** | 显示/隐藏坐标网格覆盖层 |
| **导出 PNG** | 将当前视角渲染为 PNG 图片 |
| **导出 3D 模型** | 把当前模型导出为 **GLB / glTF / OBJ / STL / PLY / USDZ / FBX**（基于 `@voxel-tool/exporter`） |
| **新建模型** | 从空白 24×24××24 画布开始 |
| **演示** | 首次打开时加载一个彩色球体 Demo |
| **图层** | 非破坏式图层面板——新增/删除/排序/重命名图层，切换可见性，设置逐层不透明度；绘制只作用于激活层 |
| **布尔 CSG** | 用并/交/差合并两个模型（载入第二个 `.vox` 后应用） |
| **对称笔刷** | 沿 X/Y/Z 轴镜像绘制——一笔即可建模对称结构 |
| **TSL 增强** | 可选 Fresnel 边缘描边 + 自发光辉光（Three Shading Language，仅 WebGPU） |
| **WebGPU 后端** | 默认以 WebGPU 渲染并自动回退 WebGL2；角标显示当前后端 |

## 操作方式

- **左键拖动** 3D 视图：旋转相机
- **滚轮**：缩放
- **右键拖动**：平移视图
- **绘制/擦除**：从工具栏选择模式后，左键点击体素

## 导出 3D 模型

使用工具栏的 **导出模型** 控件：从下拉框选择格式，点击 **导出模型** 即可下载当前体素模型。

| 格式 | 颜色 | 适用场景 |
|---|---|---|
| GLB / glTF | 顶点色 | 游戏引擎、Web、通用 |
| PLY | 顶点色 | 点云、扫描 |
| USDZ | 顶点色 | Apple 设备 AR |
| FBX | 顶点色 | DCC 工具（Blender、Maya、Unity） |
| OBJ | 仅几何 | 简单网格交换 |
| STL | 仅几何 | 3D 打印 |

> OBJ 与 STL 仅含几何（底层 Three.js 导出器的限制）——需要顶点色时请用 GLB/glTF/PLY/USDZ/FBX。

## 进阶编辑

### 图层（非破坏式）

编辑器把模型存储为一叠图层。绘制与擦除只作用于**激活层**，图层可见性 / 不透明度只影响**渲染**——隐藏或淡化某个图层时，体素数据永远不会被销毁。右侧**图层**面板支持：

- **新增 / 删除 / 排序 / 重命名**图层（始终至少保留一个图层）。
- **切换**任意图层的可见性。
- **设置逐层不透明度**（0–1）；小于 1 时该层半透明渲染。
- 选择**激活层**进行绘制。

导出与保存始终把所有可见图层合成为单一模型，因此非破坏式编辑绝不会丢数据。

### 布尔 CSG

用构造实体几何把激活层与第二个模型合并：

1. 在工具栏选择运算——**并**（A ∪ B）、**交**（A ∩ B）或**差**（A − B）。
2. 点击 **CSG 应用** 并选择第二个 `.vox`（或 `.schem`）文件。

运算在体素坐标键（网格上的集合运算）上进行，因此精确且快速——无需网格 CSG。冲突处颜色默认取主操作数（A）；底层函数见 [core API](/zh/api/core) 的 `voxelCSG`。

### 对称笔刷

在工具栏开启 **X / Y / Z** 镜像开关，一笔即可绘制对称结构。每个被放置的体素会沿启用轴关于模型中心镜像，因此你只需建模一半，编辑器补全其余。

### TSL 描边 / 自发光

工具栏的 **TSL** 开关用 Three Shading Language 增加 Fresnel 边缘描边与/或自发光辉光。它增强 WebGPU 渲染路径的实时着色节点；当运行在 WebGL2 回退路径时该开关会自动禁用（经典材质优雅降级）。

### WebGPU 后端

编辑器默认以 **WebGPU** 渲染，并在浏览器/设备不支持 WebGPU 时**自动回退 WebGL2**。右上角的小角标显示当前后端（`WebGPU` / `WebGL2`），让你随时知道走的是哪条路径。

## 技术栈

- **React** + **Three.js** 渲染（默认 WebGPU，回退 WebGL2）
- **@voxel-tool/core** 负责 `.vox` 文件读写、体素数据结构、布尔 CSG、对称与网格体素化
- **Vite** 构建，以静态 SPA 部署在 `/voxel-tool/editor/`

## 本地运行

```bash
npm run dev:editor    # 开发服务器（端口 5180）
npm run build:editor # 生产构建 → apps/vox-editor/dist
```

<style>
.editor-cta { text-align: center; margin: 2rem 0; }
.cta-button {
  display: inline-block;
  padding: 14px 36px;
  font-size: 1.15rem;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border-radius: 10px;
  text-decoration: none;
  transition: transform .15s, box-shadow .15s;
  box-shadow: 0 4px 14px rgba(99,102,241,.35);
}
.cta-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(99,102,241,.5);
}
</style>
