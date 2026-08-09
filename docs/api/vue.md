# @voxel-tool/vue

Vue 3 3D 查看器组件（基于 Three.js）。与 `@voxel-tool/react` 同一套渲染原理。

```js
import { VoxViewer } from '@voxel-tool/vue';
```

## `<VoxViewer />` Props

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `src` | `ArrayBuffer \| Uint8Array` | `null` | `.vox` 二进制；传入后组件内部调用 `parseVox` 解析 |
| `model` | `Object` | `null` | 已解析模型（来自 `parseVox` 的 `models[0]`） |
| `palette` | `Array` | `null` | 256 项调色板；与 `model` 配套 |
| `background` | `String` | `'#16181e'` | 画布背景色 |
| `size` | `Array` | `[480, 480]` | 画布尺寸 `[width, height]`（px） |

> `src` 与 `model` 二选一；两者都给时优先用 `model`。

## 交互

- **左键拖拽**：旋转视角
- **滚轮**：缩放
- **右键拖拽**：平移

组件自动取景（Box3 包围盒居中 + 缩放进可视范围），左下角显示「体素数 · 面数」。

## 示例

```vue
<script setup>
import { ref, onMounted } from 'vue';
import { VoxViewer } from '@voxel-tool/vue';
import { parseVox } from '@voxel-tool/core';

const data = ref(null);
onMounted(async () => {
  const buf = await fetch('/model.vox').then((r) => r.arrayBuffer());
  data.value = parseVox(buf);
});
</script>

<template>
  <VoxViewer v-if="data" :model="data.models[0]" :palette="data.palette" :size="[640, 480]" />
</template>
```

详见 [组件示例 · Vue](/components/vue-viewer)。
