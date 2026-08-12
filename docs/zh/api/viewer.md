# @voxel-tool/viewer

框架无关的 Three.js 体素查看器核心。所有框架组件（React / Vue / Solid / Preact / Svelte / Qwik）都复用这里的同一套渲染实现，**你也可以完全脱离 UI 框架，直接在任意 DOM 容器里挂载查看器**。

```js
import {
  createVoxelViewer, buildVoxelGeometry, buildVoxelBuckets, makeMaterial,
} from '@voxel-tool/viewer';
```

## `createVoxelViewer(container, options)`

在一个容器元素内挂载真实 3D 体素查看器，返回控制器。

| 参数 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `container` | `HTMLElement` | — | 目标 DOM 元素（必须有宽高） |
| `options.src` | `ArrayBuffer \| Uint8Array` | `null` | `.vox` 二进制；传入后内部调用 `parseVox` 解析 |
| `options.model` | `{ size, voxels }` | `null` | 已解析模型（来自 `parseVox` 的 `models[0]`） |
| `options.instances` | `Array<Instance>` | `null` | 多实例场景（来自 `parseVox` 的 `scene`）：每个 `{ voxels, translation?, rotation?, hidden?, name?, frames? }` 按世界坐标摆放。`frames` 是可选的逐帧世界变换（`[{ translation, rotation }]`）——存在即开启 **动画播放**。多模型 `.vox` 请用它代替 `model` |
| `options.palette` | `Array<[r,g,b,a]>` | `null` | 256 项调色板；与 `model` / `instances` 配套 |
| `options.materials` | `Record<number, Material>` | `null` | MATL 材质（来自 `parseVox` 的 `materials`）；颜色索引对应到材质的体素会用 `MeshStandardMaterial`（金属度 / 粗糙度 / 透明度 / 自发光）渲染，而非默认 `MeshLambertMaterial` |
| `options.background` | `string` | `'#16181e'` | 画布背景色 |
| `options.width` | `number` | `480` | 初始宽度（px） |
| `options.height` | `number` | `480` | 初始高度（px） |
| `options.renderer` | `'webgl' \| 'webgpu'` | `'webgl'` | 渲染后端。`webgpu` 按需加载 Three 的 `WebGPURenderer`，**若浏览器不支持则自动回退 WebGL**；默认 `webgl` 路径完全不变 |
| `options.frameRate` | `number` | `12` | 动画播放帧率（fps），当 `instances` 带 `frames` 时生效 |
| `options.loop` | `boolean` | `true` | 动画是否循环 |
| `options.onInfo` | `(info: [number, number] \| null) => void` | `null` | 重建后回调，参数为 `[体素数, 面数]` |
| `options.onFrame` | `(frame: number) => void` | `null` | 每次切换动画帧时回调，参数为当前帧序号 |

> 单模型传 `src` / `model`，多模型传 `instances`；两者都给时优先用 `instances`。
> 必须在浏览器环境调用（依赖 `window` / WebGL），SSR 下会抛错。

**返回值（控制器）：**

| 方法 | 说明 |
|---|---|
| `update(input?)` | 数据变化后重建网格：`update({ src?, model?, instances?, palette?, materials? })` |
| `setBackground(color)` | 修改画布背景色 |
| `play()` | 开始动画播放（仅 `frameCount > 1` 时有效） |
| `pause()` | 暂停（保留当前帧） |
| `stop()` | 停止并回到第 0 帧 |
| `setFrame(i)` | 跳到指定帧（同时暂停） |
| `setLoop(b)` | 开关循环 |
| `setFrameRate(rate)` | 设置播放 fps |
| `isPlaying()` | `boolean` —— 是否正在播放 |
| `getFrameCount()` | `number` —— 当前场景总帧数（静态为 `1`） |
| `dispose()` | 卸载：取消动画帧、断开 ResizeObserver、释放 GPU 资源 |

### 最小示例（无框架，单模型）

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

### 多模型场景（含材质）

```js
import { createVoxelViewer } from '@voxel-tool/viewer';
import { parseVox } from '@voxel-tool/core';

const buf = await fetch('/scene.vox').then((r) => r.arrayBuffer());
const { palette, scene, materials } = parseVox(buf);

const el = document.getElementById('viewer');
const viewer = createVoxelViewer(el, {
  instances: scene,   // 每个条目已自带 voxels / translation / rotation
  palette,
  materials,          // 金属 / 玻璃 / 自发光体素都能正确渲染
});
```

### 动画播放

当 `instances` 带 `frames`（即 `parseVox` 对动画 `.vox` 文件返回的逐帧世界变换）时，查看器提供一组播放控制 API：

```js
import { createVoxelViewer } from '@voxel-tool/viewer';
import { parseVox } from '@voxel-tool/core';

const buf = await fetch('/anim.vox').then((r) => r.arrayBuffer());
const { palette, scene } = parseVox(buf); // 动画场景的 scene 实例自带 frames (frameCount > 1)

const viewer = createVoxelViewer(el, {
  instances: scene,
  palette,
  frameRate: 24,   // fps
  loop: true,
  onFrame: (f) => console.log('frame', f),
});

viewer.play();            // 开始
// viewer.pause();        // 停在当前帧
// viewer.setFrame(3);    // 跳转（同时暂停）
// viewer.setLoop(false); // 播一次后停止
// viewer.stop();         // 回到第 0 帧
// viewer.getFrameCount(); // -> 总帧数
```

每个动画实例通过逐帧切换本地矩阵来移动（用的是预计算的 `frames` 变换），因此播放开销很小——不重建几何。

### 渲染后端（WebGPU）

默认使用 WebGL 渲染器。传 `renderer: 'webgpu'` 可改用 Three 的 `WebGPURenderer`：

```js
const viewer = createVoxelViewer(el, { model, palette, renderer: 'webgpu' });
```

WebGPU 后端按需加载（`import('three/webgpu')`），**若浏览器/设备不支持则自动回退 WebGL**。默认 `webgl` 路径完全不变，且 WebGPU 代码被拆成独立 chunk，只有显式请求时才下载。

## `buildVoxelGeometry(voxels, palette)`

纯函数：把体素数组编译成 Three.js `BufferGeometry`（含顶点色与面剔除后的索引）。几何处于**体素局部空间**，由查看器统一做 z-up → y-up 变换。

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

## `buildVoxelBuckets(voxels, palette, materials?)`

纯函数：按颜色索引（材质 id）把体素分桶，返回 `Array<{ geometry, materialId }>` —— 每个不同材质 id 一项。当你想自己驱动 Three.js 而非用 `createVoxelViewer` 时很有用。

| 参数 | 类型 | 说明 |
|---|---|---|
| `voxels` | `Array<{ x, y, z, i }>` | 体素列表 |
| `palette` | `Array<[r,g,b,a]>` | 256 项调色板 |
| `materials` | `Record<number, Material>` | 可选 MATL 映射 |

```js
import * as THREE from 'three';
import { buildVoxelBuckets, makeMaterial } from '@voxel-tool/viewer';

for (const { geometry, materialId } of buildVoxelBuckets(model.voxels, palette, materials)) {
  const mesh = new THREE.Mesh(geometry, makeMaterial(materialId, materials));
  scene.add(mesh);
}
```

## `makeMaterial(materialId, materials?)`

按材质 id 返回 Three.js 材质：

- `materialId === 0`（或无对应条目）：`MeshLambertMaterial`（默认，顶点色）。
- 否则：`MeshStandardMaterial`，由 `materials[materialId]` 推导 `metalness` / `roughness` / `alpha`（→ `transparent` + `opacity`）/ `emissive`。

## Greedy meshing（性能）

查看器在「面剔除」之外还用了 **greedy meshing（贪婪合并）**：把共面、同色、相邻的体素面合并成大四边形，把实心 / 扁平模型的三角形数 **降低 1～3 个数量级**——48³ 实心块从 27 648 三角形降到 **12**，而稀疏云（共面少）几乎不变。这让超大模型也能秒渲。

两组贪婪版纯函数几何辅助已导出（签名与非贪婪版一致）：

| 函数 | 说明 |
|---|---|
| `buildVoxelGeometryGreedy(voxels, palette)` | 同 `buildVoxelGeometry`，但把共面同色面合并成大四边形 |
| `buildVoxelBucketsGreedy(voxels, palette, materials?)` | 同 `buildVoxelBuckets`，但按桶贪婪合并 |

```js
import * as THREE from 'three';
import { buildVoxelGeometryGreedy } from '@voxel-tool/viewer';

const geo = buildVoxelGeometryGreedy(model.voxels, palette); // 三角形数远少于 buildVoxelGeometry
const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
```

> `createVoxelViewer` 内部默认开启 greedy meshing；`*Greedy` 函数供你自己驱动 Three.js 时使用。

## 渲染原理

- 每个体素是真实 3D 立方体，靠 WebGL **深度缓冲**正确遮挡（凹形、相邻遮挡不再有排序瑕疵）。
- **面剔除 + greedy meshing**：只保留暴露在空气中的面，再把共面同色连续段合并成大四边形——14582 体素实测仅 6098 面，实心块更是塌缩成寥寥数个三角形。
- **正交等距相机** `OrthographicCamera` 摆 `(+,+,+)` 角 → MagicaVoxel 经典观感。
- `HemisphereLight` + 主/补 `DirectionalLight` 按面法线着色。
- `OrbitControls` 自由旋转 / 缩放 / 平移。
- 根 `Group` 统一做一次 z-up → y-up 旋转；每个实例的 `translation` / `rotation` 来自场景图。
