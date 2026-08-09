# 组件示例 · Preact VoxViewer

下面是一个完整可运行的 Preact 示例：现场用 `@voxel-tool/core` 造一个「灰底座 + 彩虹球」模型，
经「写 → 读」闭环后交给 `VoxViewer` 渲染，并支持打开本地 `.vox` 文件。

```jsx
// App.jsx
import { useState } from 'preact/hooks';
import { VoxViewer } from '@voxel-tool/preact';
import { VoxelGrid, toVoxBytes, parseVox, rainbowPalette } from '@voxel-tool/core';

// 现场造模型：灰底座 + 彩虹球 -> toVoxBytes -> parseVox
function buildSample(seed = 0) {
  const SIZE = 40;
  const grid = new VoxelGrid(SIZE, SIZE, SIZE + 10);
  for (let x = 0; x < SIZE; x++)
    for (let y = 0; y < SIZE; y++) grid.set(x, y, 0, 200); // 索引 200 = 灰

  const cz = 16 + (seed % 5);
  const r = 18;
  grid.addSphere(20, 20, cz, r, (dx, dy, dz) => {
    const frac = Math.max(0, Math.min(1, (dz + r) / (2 * r)));
    return 1 + Math.round(frac * 253);
  });

  const palette = rainbowPalette();
  return parseVox(toVoxBytes(grid, palette));
}

export function App() {
  const [info, setInfo] = useState(() => buildSample(0));
  const [seed, setSeed] = useState(0);
  const [fileName, setFileName] = useState('内置示例 (灰底座 + 彩虹球)');

  const regenerate = () => {
    const s = (seed + 1) % 100;
    setSeed(s);
    setInfo(buildSample(s));
    setFileName(`内置示例 #${s}`);
  };

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const buf = new Uint8Array(await f.arrayBuffer());
    try {
      setInfo(parseVox(buf));
      setFileName(f.name);
    } catch (err) {
      alert('解析失败: ' + err.message);
    }
  };

  const model = info.models[0];

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start' }}>
      <h1 style={{ margin: 0, fontSize: 20 }}>@voxel-tool/preact · 体素模型查看器</h1>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={regenerate}>重新生成</button>
        <label>
          打开 .vox 文件
          <input type="file" accept=".vox" onChange={onFile} style={{ display: 'none' }} />
        </label>
        <span style={{ color: '#8b93a7', fontSize: 13 }}>
          {fileName} · {model.voxels.length} 体素 · {model.size.join('×')}
        </span>
      </div>

      <VoxViewer model={model} palette={info.palette} />

      <p style={{ color: '#8b93a7', fontSize: 13, maxWidth: 520, lineHeight: 1.6 }}>
        左键拖拽旋转 · 滚轮缩放 · 右键平移。组件基于 Three.js 真实 3D 渲染（深度缓冲 + 面剔除），
        与 <code>@voxel-tool/core</code> 解耦：既可传 <code>src</code>（.vox 二进制），也可传已解析的 <code>{ '{ model, palette }' }</code>。
      </p>
    </div>
  );
}
```

## 本地预览

```bash
npm run dev:preact   # -> http://localhost:5175
```

源码见 [`packages/preact/example/`](https://github.com/Maicarons/voxel-tool/tree/main/packages/preact/example)。

## 渲染原理（为什么比 Canvas2D 更稳）

- 每个体素是真实 3D 立方体，靠 WebGL **深度缓冲**正确遮挡（凹形、相邻遮挡不再有排序瑕疵）。
- **面剔除**：只生成暴露在空气中的面（邻接 6 方向检查），14582 体素实测仅 6098 面。
- **正交等距相机** `OrthographicCamera` 摆 `(+,+,+)` 角 → MagicaVoxel 经典观感。
- `HemisphereLight` + 主/补 `DirectionalLight` 按面法线着色。
- `OrbitControls` 自由旋转 / 缩放 / 平移。
