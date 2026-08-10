# @voxel-tool/svelte

Svelte 5（runes）3D 查看器组件（基于 `@voxel-tool/viewer` + Three.js）。真 3D 立方体 + 深度缓冲 + 面剔除 + 正交等距相机 + OrbitControls。

```js
import { VoxViewer } from '@voxel-tool/svelte';
```

## `<VoxViewer />` Props

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `src` | `ArrayBuffer \| Uint8Array` | `null` | `.vox` 二进制；传入后组件内部调用 `parseVox` 解析 |
| `model` | `{ size, voxels }` | `null` | 已解析模型（来自 `parseVox` 的 `models[0]`） |
| `palette` | `Array<[r,g,b,a]>` | `null` | 256 项调色板；与 `model` 配套 |
| `background` | `string` | `'#16181e'` | 画布背景色 |
| `size` | `[number, number]` | `[480, 480]` | 画布尺寸 `[width, height]`（px） |

> `src` 与 `model` 二选一；两者都给时优先用 `model`。
> Svelte 版用 `size` 数组（与 Vue 一致），其它框架版用 `width` / `height` 两个独立属性。

## 交互

- **左键拖拽**：旋转视角
- **滚轮**：缩放
- **右键拖拽**：平移

组件自动取景（Box3 包围盒居中 + 缩放进可视范围），左下角显示「体素数 · 面数」。

## 示例

```svelte
<script>
  import { VoxViewer } from '@voxel-tool/svelte';
  import { parseVox } from '@voxel-tool/core';

  let data = $state(null);
  async function onFile(e) {
    const buf = new Uint8Array(await e.currentTarget.files[0].arrayBuffer());
    data = parseVox(buf);
  }
</script>

<input type="file" accept=".vox" onchange={onFile} />
{#if data}
  <VoxViewer model={data.models[0]} palette={data.palette} size={[640, 480]} />
{/if}
```

详见 [组件示例 · Svelte](/zh/components/svelte-viewer)。
