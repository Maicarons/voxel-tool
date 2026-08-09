import { useState } from 'preact/hooks';
import { VoxViewer } from '@voxel-tool/preact';
import { VoxelGrid, toVoxBytes, parseVox, rainbowPalette } from '@voxel-tool/core';

function buildSample(seed = 0) {
  const SIZE = 40;
  const grid = new VoxelGrid(SIZE, SIZE, SIZE + 10);
  for (let x = 0; x < SIZE; x++)
    for (let y = 0; y < SIZE; y++) grid.set(x, y, 0, 200); // 调色板索引 200 = 灰

  const cz = 16 + (seed % 5);
  const r = 18;
  grid.addSphere(20, 20, cz, r, (dx, dy, dz) => {
    const frac = Math.max(0, Math.min(1, (dz + r) / (2 * r)));
    return 1 + Math.round(frac * 253);
  });

  const palette = rainbowPalette();
  return parseVox(toVoxBytes(grid, palette));
}

const btn = {
  background: '#2b6cff', color: '#fff', border: 'none', borderRadius: '6px',
  padding: '8px 14px', fontSize: '13px', cursor: 'pointer',
};

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
        <button onClick={regenerate} style={btn}>重新生成</button>
        <label style={btn}>
          打开 .vox 文件
          <input type="file" accept=".vox" onChange={onFile} style={{ display: 'none' }} />
        </label>
        <span style={{ color: '#8b93a7', fontSize: 13 }}>
          {fileName} · {model.voxels.length} 体素 · {model.size.join('×')}
        </span>
      </div>

      <VoxViewer model={model} palette={info.palette} />

      <p style={{ color: '#8b93a7', fontSize: 13, maxWidth: 520, lineHeight: 1.6 }}>
        左键拖拽旋转 · 滚轮缩放 · 右键平移。组件基于 Three.js 真实 3D 渲染 (深度缓冲 + 面剔除)。
      </p>
    </div>
  );
}
