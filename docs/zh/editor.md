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
| **新建模型** | 从空白 24×24××24 画布开始 |
| **演示** | 首次打开时加载一个彩色球体 Demo |

## 操作方式

- **左键拖动** 3D 视图：旋转相机
- **滚轮**：缩放
- **右键拖动**：平移视图
- **绘制/擦除**：从工具栏选择模式后，左键点击体素

## 技术栈

- **React 18** + **Three.js** 渲染
- **@voxel-tool/core** 处理 `.vox` 文件读写与体素数据结构
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
