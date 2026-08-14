# voxel-viewer — 框架组件完整用法

所有六个包导出默认 `VoxViewer`，prop 完全一致：`src`, `model`, `palette`, `background`, `width`, `height`。**`src` 必须是 `.vox` 二进制 `ArrayBuffer`/`Uint8Array`（不是 URL 字符串）** —— 先 `fetch` 文件再传字节。Viewer 仅浏览器运行（WebGPU 默认，回退 WebGL2）。

## React (`@voxel-tool/react`)

```jsx
import VoxViewer from '@voxel-tool/react';

export default function App({ voxBytes }) {
  return <VoxViewer src={voxBytes} width={480} height={480} background="#16181e" />;
}
```

## Vue 3 (`@voxel-tool/vue`)

```vue
<script setup>
import VoxViewer from '@voxel-tool/vue';
defineProps({ voxBytes: { type: [ArrayBuffer, Uint8Array], required: true } });
</script>
<template>
  <VoxViewer :src="voxBytes" :width="480" :height="480" background="#16181e" />
</template>
```

## Solid (`@voxel-tool/solid`)

```jsx
import VoxViewer from '@voxel-tool/solid';

<VoxViewer src={voxBytes} width={480} height={480} background="#16181e" />
```

## Preact (`@voxel-tool/preact`)

```jsx
import VoxViewer from '@voxel-tool/preact';

<VoxViewer src={voxBytes} width={480} height={480} />
```

## Svelte (`@voxel-tool/svelte`)

```svelte
<script>
  import VoxViewer from '@voxel-tool/svelte';
  export let voxBytes;
</script>

<VoxViewer src={voxBytes} width={480} height={480} />
```

## Qwik (`@voxel-tool/qwik`)

```tsx
import VoxViewer from '@voxel-tool/qwik';
import { component$ } from '@builder.io/qwik';

export const App = component$(() => {
  return <VoxViewer src={voxBytes} width={480} height={480} />;
});
```

## Peer dependencies

| Package | Peer |
|---------|------|
| `@voxel-tool/react` | React `^18 || ^19` |
| `@voxel-tool/vue` | Vue `^3` |
| `@voxel-tool/solid` | Solid `^1` |
| `@voxel-tool/preact` | Preact `^10` |
| `@voxel-tool/svelte` | Svelte `^4 || ^5` |
| `@voxel-tool/qwik` | Qwik `^1` |

每个组件包同时依赖 `@voxel-tool/core` + `@voxel-tool/viewer`（已作为其依赖解析）。动画播放（`play`/`pause`）在 viewer 实例上，不在组件 props；框架组件默认自动渲染 `src` 变化。
