# 组件示例 · Svelte VoxViewer

下面是一个完整可运行的 Svelte 5（runes）示例：现场用 `@voxel-tool/core` 造一个「灰底座 + 彩虹球」模型，
经「写 → 读」闭环后交给 `VoxViewer` 渲染，并支持打开本地 `.vox` 文件。

```svelte
<!-- App.svelte -->
<script>
  import { VoxViewer } from '@voxel-tool/svelte';
  import { VoxelGrid, toVoxBytes, parseVox, rainbowPalette } from '@voxel-tool/core';

  const btn =
    'background:#2b6cff;color:#fff;border:none;border-radius:6px;padding:8px 14px;font-size:13px;cursor:pointer;';

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

  let info = $state(buildSample(0));
  let seed = $state(0);
  let fileName = $state('内置示例 (灰底座 + 彩虹球)');

  function regenerate() {
    const s = (seed + 1) % 100;
    seed = s;
    info = buildSample(s);
    fileName = `内置示例 #${s}`;
  }

  async function onFile(e) {
    const f = e.currentTarget.files?.[0];
    if (!f) return;
    const buf = new Uint8Array(await f.arrayBuffer());
    try {
      info = parseVox(buf);
      fileName = f.name;
    } catch (err) {
      alert('解析失败: ' + err.message);
    }
  }
</script>

<div style="padding:24px;display:flex;flex-direction:column;gap:16px;align-items:flex-start;">
  <h1 style="margin:0;font-size:20px;">@voxel-tool/svelte · 体素模型查看器</h1>
  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
    <button style={btn} onclick={regenerate}>重新生成</button>
    <label style={btn}>
      打开 .vox 文件
      <input type="file" accept=".vox" onchange={onFile} style="display:none;" />
    </label>
    <span style="color:#8b93a7;font-size:13px;">
      {fileName} · {info.models[0].voxels.length} 体素 · {info.models[0].size.join('×')}
    </span>
  </div>

  <VoxViewer model={info.models[0]} palette={info.palette} size={[480, 480]} />

  <p style="color:#8b93a7;font-size:13px;max-width:520px;line-height:1.6;">
    左键拖拽旋转 · 滚轮缩放 · 右键平移。组件基于 Three.js 真实 3D 渲染（深度缓冲 + 面剔除），
    与 <code>@voxel-tool/core</code> 解耦：既可传 <code>src</code>（.vox 二进制），也可传已解析的 <code>{ model, palette }</code>。
  </p>
</div>
```

## 本地预览

```bash
npm run dev:svelte   # -> http://localhost:5177
```

源码见 [`packages/svelte/example/`](https://github.com/Maicarons/voxel-tool/tree/main/packages/svelte/example)。

## 渲染原理（为什么比 Canvas2D 更稳）

- 每个体素是真实 3D 立方体，靠 WebGL **深度缓冲**正确遮挡（凹形、相邻遮挡不再有排序瑕疵）。
- **面剔除**：只生成暴露在空气中的面（邻接 6 方向检查），14582 体素实测仅 6098 面。
- **正交等距相机** `OrthographicCamera` 摆 `(+,+,+)` 角 → MagicaVoxel 经典观感。
- `HemisphereLight` + 主/补 `DirectionalLight` 按面法线着色。
- `OrbitControls` 自由旋转 / 缩放 / 平移。
