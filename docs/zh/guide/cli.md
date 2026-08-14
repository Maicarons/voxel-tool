# 命令行工具（`@voxel-tool/cli`）

无头 Node CLI——**无需浏览器**。提供两个可执行命令：

- **`voxel-export`** —— `.vox` / `.schem` ↔ GLB / glTF / OBJ / STL / PLY / USDZ / FBX 双向转换、导出 Minecraft Schematic，以及网格体素化（`.glb` / `.stl` → `.vox`）。
- **`voxel-csg`** —— 对两个体素文件执行布尔 CSG（并/交/差）。

## 安装

```bash
npm install -g @voxel-tool/cli
# 或即开即用：
npx @voxel-tool/cli voxel-export model.vox
```

## `voxel-export`

### 正向：`.vox` / `.schem` → 3D 格式

```bash
voxel-export model.vox                       # -> model.glb（默认）
voxel-export model.vox -f obj -o model.obj
voxel-export model.vox -f fbx
voxel-export model.vox -f stl --ascii
voxel-export model.vox -f schem -o model.schem   # -> Minecraft Schematic
voxel-export model.schem -f glb -o model.glb      # Schematic -> GLB
voxel-export model.vox -d                          # Draco 压缩的 GLB
```

| 参数 | 别名 | 说明 |
|---|---|---|
| `--format <fmt>` | `-f` | `glb`（默认）、`gltf`、`obj`、`stl`、`ply`、`usdz`、`fbx`、`schem`、`vox` |
| `--output <path>` | `-o` | 输出路径（默认 `<输入>-out.<fmt>`） |
| `--ascii` | | 文本 STL/PLY 而非二进制 |
| `--draco` | `-d` | 对 GLB/glTF 启用 Draco 压缩（体积 10×+ 缩小，保留材质 + 动画） |
| `--list` | `-l` | 列出支持的格式后退出 |
| `--help` | `-h` | 显示帮助 |

### 逆向：网格 → `.vox`（体素化）

任意 `.glb` / `.gltf` / `.obj` / `.stl` 都能体素化回 `.vox`：

```bash
voxel-export model.glb -r 96 -o model.vox          # 最长轴分辨率 96
voxel-export model.stl --solid -r 48 -o model.vox  # 实心填充（需封闭流形）
voxel-export model.obj -r 64,64,128 -o model.vox   # 显式 nx,ny,nz
```

| 参数 | 别名 | 说明 |
|---|---|---|
| `--resolution <n>` | `-r` | 最长轴体素分辨率（默认 `64`）；或 `nx,ny,nz` |
| `--solid` | | 实心模式（需封闭流形）；默认表面 `shell` |
| `--pad <n>` | | 包围盒外扩 `n` 个体素 |

GLB/GLTF/PLY/USDZ/FBX 保留顶点色；OBJ 与 STL 仅含几何（按位置体素化）。库用法见 [使用指南](/zh/guide/usage)。

## `voxel-csg`

对两个体素文件执行布尔 CSG：

```bash
voxel-csg union a.vox b.vox -o merged.vox
voxel-csg difference a.vox b.vox        # 从 a 减掉 b（挖洞）
voxel-csg intersection a.vox b.vox      # 取两者重合部分
voxel-csg union a.vox b.vox --tie b     # 冲突处取 b 的颜色
```

| 参数 / 选项 | 说明 |
|---|---|
| `<op>` | `union` / `intersection` / `difference` |
| `<a.vox>` `<b.vox>` | 操作数（`.vox` 或 `.schem`） |
| `--output <path>` | `-o` | 输出 `.vox`（默认 `<a>_<op>_<b>.vox`） |
| `--tie <a\|b>` | 冲突坐标的颜色归属（默认 `a`） |
| `--help` | `-h` | 显示帮助 |

该运算精确且快速——是体素坐标键上的集合运算，而非网格 CSG。底层函数见 [core API](/zh/api/core) 的 `voxelCSG`。
