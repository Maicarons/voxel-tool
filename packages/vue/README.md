# @vox/vue

MagicaVoxel `.vox` 体素模型的 **Vue 3 3D 查看器组件包**，底层基于 [`@vox/base`](../js)。采用与 MagicaVoxel 一致的「真 3D」渲染原理（参考 threejs-vox-loader / coding.kiwi 的 *Rendering .vox Files*）。

- 每个体素是 Three.js 真实 3D 立方体，靠 **WebGL 深度缓冲**正确遮挡（无画家算法排序瑕疵）
- **面剔除 (face culling)**：只渲染暴露在空气中的面（14k 体素实际只生成约 6k 面），大模型也能流畅旋转
- **正交等距相机** + `OrbitControls`：**左键拖拽旋转 · 滚轮缩放 · 右键平移**
- 主/补 `DirectionalLight` + `HemisphereLight` 按面法线着色
- 可接收 `.vox` 二进制（`ArrayBuffer` / `Uint8Array`），或直接接收已解析的 `{ model, palette }`

---

## 安装

```bash
npm install @vox/vue @vox/base three
# peerDependencies: vue ^3.3+
```

> 本仓库内以 `file:../js` 引用 `@vox/base`，`three` 为直接依赖；本地联调无需发布。

---

## 用法

```vue
<script setup>
import { VoxViewer } from '@vox/vue';
import { parseVox } from '@vox/base';

// 方式一: 直接传 .vox 二进制
const buf = await (await fetch('/model.vox')).arrayBuffer();
// <VoxViewer :src="buf" />

// 方式二: 传已解析模型 (推荐)
const info = parseVox(buf); // { version, models:[{size,voxels}], palette }
// <VoxViewer :model="info.models[0]" :palette="info.palette" />
</script>

<template>
  <VoxViewer :model="info.models[0]" :palette="info.palette" />
</template>
```

### Props

| 名称         | 类型                              | 说明                                         |
| ------------ | --------------------------------- | -------------------------------------------- |
| `src`        | `ArrayBuffer \| Uint8Array`       | `.vox` 二进制；与 `model` 二选一              |
| `model`      | `{ size:[number,number,number], voxels:[{x,y,z,i}] }` | 已解析模型              |
| `palette`    | `Array<[r,g,b,a]>\|null` (256 项) | 调色板；`null` 时退化成灰色                   |
| `size`       | `[number, number]`               | 画布 `[宽,高]`（px），默认 `[480, 480]`       |
| `background` | `string`                          | 背景色，默认 `#16181e`                        |

---

## 本地示例（无需发布即可看效果）

```bash
cd vue
npm install        # 安装 vue / vite / three 等 (会软链 ../js 作为 @vox/base)
npm run dev        # 启动 http://localhost:5174
```

示例会**现场用 `@vox/base` 造一个模型**（灰底座 + 彩虹球 → `toVoxBytes` → `parseVox` → 渲染），
也可通过「打开 .vox 文件」按钮加载你自己的模型。

---

## 纯逻辑测试（无浏览器）

```bash
npm test           # node test.mjs: 验证 buildVoxelGeometry 的面剔除 (单体素=6面, 2x2x2=24面, 真实模型面数<<6x体素)
```

---

## 作为库发布

```bash
npm run build      # 用 Vite 打成 dist (ESM), vue/three 作 externals
```

导出内容：

```js
import { VoxViewer, buildVoxelGeometry } from '@vox/vue';
```

- `VoxViewer`：Vue 3 SFC 组件，封装 Three.js 场景 / 相机 / 光照 / `OrbitControls` / 资源清理（`onBeforeUnmount` 释放）。
- `buildVoxelGeometry(voxels, palette)`：框架无关纯函数，返回带面剔除与顶点色的 `THREE.BufferGeometry`
  （仅依赖 `three` 的 `BufferGeometry`，不需要 WebGL，可在 Node 里直接调用验证）。
