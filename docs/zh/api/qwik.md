# @voxel-tool/qwik

Qwik 3D 查看器组件（基于 `@voxel-tool/viewer` + Three.js）。真 3D 立方体 + 深度缓冲 + 面剔除 + 正交等距相机 + OrbitControls。

```tsx
import { VoxViewer } from '@voxel-tool/qwik';
```

## `<VoxViewer />` Props

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `src` | `ArrayBuffer \| Uint8Array` | `null` | `.vox` 二进制；传入后组件内部调用 `parseVox` 解析 |
| `model` | `{ size, voxels }` | `null` | 已解析模型（来自 `parseVox` 的 `models[0]`） |
| `palette` | `Array<[r,g,b,a]>` | `null` | 256 项调色板；与 `model` 配套 |
| `background` | `string` | `'#16181e'` | 画布背景色 |
| `width` | `number` | `480` | 画布宽度（px） |
| `height` | `number` | `480` | 画布高度（px） |

> `src` 与 `model` 二选一；两者都给时优先用 `model`。

## Qwik 专属注意事项

- 组件在 **浏览器可见时**（`useVisibleTask$`）才挂载查看器，天然契合 Qwik 的「可恢复性（resumability）」。
- 通过 `useStore` + `useTask$` 桥接 props 变化，属性变化会自动 `update()` 重建网格。
- ⚠️ **消费端项目必须在自身 Vite 配置启用 `@builder.io/qwik/vite` 优化器**，否则本库导出的 QRL 无法被正确解析。

## 交互

- **左键拖拽**：旋转视角
- **滚轮**：缩放
- **右键拖拽**：平移

组件自动取景（Box3 包围盒居中 + 缩放进可视范围），左下角显示「体素数 · 面数」。

## 示例

```tsx
import { component$, useSignal, $ } from '@builder.io/qwik';
import { VoxViewer } from '@voxel-tool/qwik';
import { parseVox } from '@voxel-tool/core';

export const App = component$(() => {
  const data = useSignal(null);
  const onFile = $(async (e: any) => {
    const buf = new Uint8Array(await e.target.files[0].arrayBuffer());
    data.value = parseVox(buf);
  });
  return (
    <div>
      <input type="file" accept=".vox" onchange$={onFile} />
      {data.value && <VoxViewer model={data.value.models[0]} palette={data.value.palette} />}
    </div>
  );
});
```

详见 [组件示例 · Qwik](/zh/components/qwik-viewer)。
