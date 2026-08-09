import React, { useMemo, useRef, useState } from 'react';
import { VoxViewer } from '@voxel-tool/react';
import { VoxelGrid, toVoxBytes, parseVox, rainbowPalette } from '@voxel-tool/core';

// 在浏览器里用 @vox/base 现场造一个模型: 灰底座 + 彩虹球。
// 经过「写 (toVoxBytes) -> 读 (parseVox)」完整闭环, 再交给 VoxViewer 渲染,
// 正好演示了 写入 / 读取 / 可视化 三条链路。
function buildSample(seed = 0) {
  const SIZE = 40;
  const grid = new VoxelGrid(SIZE, SIZE, SIZE + 10);
  for (let x = 0; x < SIZE; x++)
    for (let y = 0; y < SIZE; y++) grid.set(x, y, 0, 200); // 调色板索引 200 = 灰

  const cz = 16 + (seed % 5);
  const r = 18;
  grid.addSphere(20, 20, cz, r, (dx, dy, dz) => {
    const frac = Math.max(0, Math.min(1, (dz + r) / (2 * r))); // 由下到上渐变
    return 1 + Math.round(frac * 253);
  });

  const palette = rainbowPalette();
  const bytes = toVoxBytes(grid, palette);
  return parseVox(bytes);
}

export default function App() {
  const [info, setInfo] = useState(() => buildSample(0));
  const [seed, setSeed] = useState(0);
  const [fileName, setFileName] = useState('内置示例 (灰底座 + 彩虹球)');
  const fileRef = useRef(null);

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
      <h1 style={{ margin: 0, fontSize: 20 }}>@voxel-tool/react · 体素模型查看器</h1>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={regenerate} style={btn}>重新生成</button>
        <button onClick={() => fileRef.current?.click()} style={btn}>打开 .vox 文件</button>
        <input ref={fileRef} type="file" accept=".vox" onChange={onFile} style={{ display: 'none' }} />
        <span style={{ color: '#8b93a7', fontSize: 13 }}>
          {fileName} · {model.voxels.length} 体素 · {model.size.join('×')}
        </span>
      </div>

      <VoxViewer model={model} palette={info.palette} />

      <p style={{ color: '#8b93a7', fontSize: 13, maxWidth: 520, lineHeight: 1.6 }}>
        左键拖拽旋转 · 滚轮缩放 · 右键平移。组件基于 Three.js 真实 3D 渲染 (深度缓冲 + 面剔除),
        与 <code>@voxel-tool/core</code> 解耦: 既可传入 <code>src</code> (.vox 二进制),
        也可直接传入已解析的 <code>{'{ model, palette }'}</code>。
      </p>
    </div>
  );
}

const btn = {
  background: '#2b6cff',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '8px 14px',
  fontSize: 13,
  cursor: 'pointer',
};
