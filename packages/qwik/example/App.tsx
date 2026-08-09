// qwik 示例: 现场用 @voxel-tool/core 造一个「灰底座 + 彩虹球」模型,
// 经「写 -> 读」闭环后交给 <VoxViewer> 渲染, 并支持打开本地 .vox 文件。
import { component$, useSignal, $ } from '@builder.io/qwik';
import { VoxViewer } from '@voxel-tool/qwik';
import { VoxelGrid, toVoxBytes, parseVox, rainbowPalette } from '@voxel-tool/core';

const btn =
  'background:#2b6cff;color:#fff;border:none;border-radius:6px;padding:8px 14px;font-size:13px;cursor:pointer;';

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

export const App = component$(() => {
  const info = useSignal(buildSample(0));
  const seed = useSignal(0);
  const fileName = useSignal('内置示例 (灰底座 + 彩虹球)');

  const regenerate = $(() => {
    const s = (seed.value + 1) % 100;
    seed.value = s;
    info.value = buildSample(s);
    fileName.value = `内置示例 #${s}`;
  });

  const onFile = $(async (e: any) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const buf = new Uint8Array(await f.arrayBuffer());
    try {
      info.value = parseVox(buf);
      fileName.value = f.name;
    } catch (err: any) {
      alert('解析失败: ' + err.message);
    }
  });

  return (
    <div style={{ padding: '24px', display: 'flex', 'flex-direction': 'column', gap: '16px', 'align-items': 'flex-start' }}>
      <h1 style={{ margin: 0, 'font-size': '20px' }}>@voxel-tool/qwik · 体素模型查看器</h1>
      <div style={{ display: 'flex', gap: '8px', 'align-items': 'center', 'flex-wrap': 'wrap' }}>
        <button style={btn} onClick$={regenerate}>重新生成</button>
        <label style={btn}>
          打开 .vox 文件
          <input type="file" accept=".vox" onchange$={onFile} style={{ display: 'none' }} />
        </label>
        <span style={{ color: '#8b93a7', 'font-size': '13px' }}>
          {fileName.value} · {info.value.models[0].voxels.length} 体素 · {info.value.models[0].size.join('×')}
        </span>
      </div>

      <VoxViewer model={info.value.models[0]} palette={info.value.palette} />

      <p style={{ color: '#8b93a7', 'font-size': '13px', 'max-width': '520px', 'line-height': 1.6 }}>
        左键拖拽旋转 · 滚轮缩放 · 右键平移。组件基于 Three.js 真实 3D 渲染 (深度缓冲 + 面剔除)。
      </p>
    </div>
  );
});
