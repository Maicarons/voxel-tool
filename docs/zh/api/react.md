# @voxel-tool/react

React 3D 查看器组件（基于 Three.js）。真 3D 立方体 + 深度缓冲 + 面剔除 + 正交等距相机 + OrbitControls。

```jsx
import { VoxViewer } from '@voxel-tool/react';
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

## 交互

- **左键拖拽**：旋转视角
- **滚轮**：缩放
- **右键拖拽**：平移

组件自动取景（Box3 包围盒居中 + 缩放进可视范围），左下角显示「体素数 · 面数」。

## 示例

```jsx
import { useEffect, useState } from 'react';
import { VoxViewer } from '@voxel-tool/react';
import { parseVox } from '@voxel-tool/core';

export default function App() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/model.vox')
      .then((r) => r.arrayBuffer())
      .then((buf) => setData(parseVox(buf)));
  }, []);

  if (!data) return <p>加载中…</p>;
  return <VoxViewer model={data.models[0]} palette={data.palette} width={640} height={480} />;
}
```

详见 [组件示例 · React](/zh/components/react-viewer)。
