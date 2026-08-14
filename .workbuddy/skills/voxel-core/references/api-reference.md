# voxel-core — 完整 API 参考 (`@voxel-tool/core`)

本文件是 `voxel-core` skill 的补充。SKILL.md 覆盖最常用的 `parseVox` / `toVoxBytesScene` / `VoxelGrid` / `gridToModel`；这里列出全部导出与精确签名。

## 全部导出（常用）

`parseVox`, `toVoxBytes`, `toVoxBytesScene`, `VoxelGrid`, `gridFromMap`, `voxelizeMesh`, `voxelCSG`, `mirrorCoordinates`, `parseSchematic`, `voxelToSchematic`, `defaultPalette`, `hsvToRgb`, `rainbowPalette`, `MAGIC`, `VERSION`, `ROTATION_MATRICES`

## `VoxelGrid` 完整方法

```js
const g = new VoxelGrid(sx, sy, sz);
g.set(x, y, z, ci);                                  // 设置体素（ci = 调色板索引 1..255）
g.get(x, y, z);                                      // 返回 ci 或 undefined
g.has(x, y, z);                                      // boolean
g.delete(x, y, z);                                   // 删除
g.length;                                            // 体素数量（getter）
g.list();                                            // -> [{ x, y, z, i }]
g.forEach((v) => { /* v = {x,y,z,i} */ });            // 遍历
g.addSphere(cx, cy, cz, r, (dx,dy,dz,dist) => ci);   // 球体笔刷
g.clone();                                           // 深拷贝
g.equals(other);                                     // 比较
```

## `voxelizeMesh(triangles, opts)`

Mesh → `{ grid: VoxelGrid, palette: number[][] }`。

- `triangles`: 三角形数组，每项 `[ [x,y,z], [x,y,z], [x,y,z] ]`（世界坐标）。
- `opts`:
  - `resolution = 64` — 最大维度体素数。
  - `mode = 'shell' | 'solid'` — `shell` 只表面壳（默认，无需闭合）；`solid` 需要闭合流形。
  - `pad = 0` — 包围盒外扩体素数。
  - `color` — 单色模式下的 RGB。
  - `bounds` — 自定义包围盒 `[min,max]`。

## CSG（详见 `voxel-csg` skill）

```ts
voxelCSG(A: VoxelGrid, B: VoxelGrid, op: 'union'|'intersection'|'difference', options?: { colorTie?: 'a'|'b' }): VoxelGrid
gridFromMap(map: Map<string, number>, size: [number, number, number]): VoxelGrid
```

`colorTie` 决定两个操作数都存在的体素用谁的调色板索引。`difference` 有序：`A - B` ≠ `B - A`。

## 调色板助手

| 函数 | 作用 |
|------|------|
| `defaultPalette()` | 返回 256×[r,g,b,a] 默认 MagicaVoxel 调色板 |
| `hsvToRgb(h, s, v)` | HSV → [r,g,b]（分量 0..1） |
| `rainbowPalette()` | 生成彩虹调色板 |
| `blockColor(name)` | Minecraft 方块名 → [r,g,b,a]（`.schem` 用） |

## 对称 / schematic

- `mirrorCoordinates(grid, axis)` → 沿轴镜像复制体素（对称笔刷基础）。
- `parseSchematic(bytes)` / `voxelToSchematic(vox, opts)` → 详见 `voxel-schematic` skill。

## 常量

`MAGIC`（'VOX ' 四字节）、`VERSION`、`ROTATION_MATRICES`（DIR 旋转矩阵表）。
