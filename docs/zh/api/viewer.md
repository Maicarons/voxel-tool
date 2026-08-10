# @voxel-tool/viewer

框架无关的 Three.js 体素查看器核心。所有框架组件（React / Vue / Solid / Preact / Svelte / Qwik）都复用这里的同一套渲染实现，**你也可以完全脱离 UI 框架，直接在任意 DOM 容器里挂载查看器**。

```js
import { createVoxelViewer, buildVoxelGeometry } from '@voxel-tool/viewer';
```

## `createVoxelViewer(container, options)`

在一个容器元素内挂载真实 3D 体素查看器，返回控制器。

| 参数 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `container` | `HTMLElement` | — | 目标 DOM 元素（必须有宽高） |
| `options.src` | `ArrayBuffer \| Uint8Array` | `null` | `.vox` 二进制；传入后内部调用 `parseVox` 解析 |
| `options.model` | `{ size, voxels }` | `null` | 已解析模型（来自 `parseVox` 的 `models[0]`） |
| `options.palette` | `Array<[r,g,b,a]>` | `null` | 256 项调色板；与 `model` 配套 |
| `options.background` | `string` | `'#16181e'` | 画布背景色 |
| `options.width` | `number` | `480` | 初始宽度（px） |
| `options.height` | `number` | `480` | 初始高度（px） |
| `options.onInfo` | `(info: [number, number] \| null) => void` | `null` | 重建后回调，参数为 `[体素数, 面数]` |

> `src` 与 `model` 二选一；两者都给时优先用 `model`。
> 必须在浏览器环境调用（依赖 `window` / WebGL），SSR 下会抛错。

**返回值（控制器）：**

| 方法 | 说明 |
|---|---|
| `update(input?)` | 数据变化后重建网格：`update({ src?, model?, palette? })` |
| `setBackground(color)` | 修改画布背景色 |
| `dispose()` | 卸载：取消动画帧、断开 ResizeObserver、释放 GPU 资源 |

### 最小示例（无框架）

```js
import { createVoxelViewer } from '@voxel-tool/viewer';
import { parseVox } from '@voxel-tool/core';

const buf = await fetch('/model.vox').then((r) => r.arrayBuffer());
const { models, palette } = parseVox(buf);

const el = document.getElementById('viewer');
const viewer = createVoxelViewer(el, {
  model: models[0],
  palette,
  onInfo: ([voxels, faces]) => console.log(voxels, faces),
});

// 切换模型 / 卸载
// viewer.update({ model: other, palette });
// viewer.dispose();
```

## `buildVoxelGeometry(voxels, palette)`

纯函数：把体素数组编译成 Three.js `BufferGeometry`（含顶点色与面剔除后的索引）。

| 参数 | 类型 | 说明 |
|---|---|---|
| `voxels` | `Array<{ x, y, z, i }>` | 体素列表 |
| `palette` | `Array<[r,g,b,a]>` | 256 项调色板 |

- 面剔除：只生成暴露在空气中的面（邻接 6 方向检查），把 6×N 个面砍到外壳。
- 返回几何体可用 `geo.index.count / 6` 得到面数、`/ 3` 得到三角形数。

```js
import * as THREE from 'three';
import { buildVoxelGeometry } from '@voxel-tool/viewer';

const geo = buildVoxelGeometry(model.voxels, palette);
const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
```

## 渲染原理

- 每个体素是真实 3D 立方体，靠 WebGL **深度缓冲**正确遮挡（凹形、相邻遮挡不再有排序瑕疵）。
- **面剔除**：只生成暴露在空气中的面，14582 体素实测仅 6098 面。
- **正交等距相机** `OrthographicCamera` 摆 `(+,+,+)` 角 → MagicaVoxel 经典观感。
- `HemisphereLight` + 主/补 `DirectionalLight` 按面法线着色。
- `OrbitControls` 自由旋转 / 缩放 / 平移。
