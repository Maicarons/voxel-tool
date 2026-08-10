# Component Example · Svelte VoxViewer

A complete, runnable Svelte 5 (runes) example: it builds a "gray base + rainbow sphere" model on the fly with `@voxel-tool/core`,
runs it through a write → read round-trip, hands it to `VoxViewer` for rendering, and also supports opening a local `.vox` file.

```svelte
<!-- App.svelte -->
<script>
  import { VoxViewer } from '@voxel-tool/svelte';
  import { VoxelGrid, toVoxBytes, parseVox, rainbowPalette } from '@voxel-tool/core';

  const btn =
    'background:#2b6cff;color:#fff;border:none;border-radius:6px;padding:8px 14px;font-size:13px;cursor:pointer;';

  // Build on the fly: gray base + rainbow sphere -> toVoxBytes -> parseVox
  function buildSample(seed = 0) {
    const SIZE = 40;
    const grid = new VoxelGrid(SIZE, SIZE, SIZE + 10);
    for (let x = 0; x < SIZE; x++)
      for (let y = 0; y < SIZE; y++) grid.set(x, y, 0, 200); // index 200 = gray

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
  let fileName = $state('Built-in sample (gray base + rainbow sphere)');

  function regenerate() {
    const s = (seed + 1) % 100;
    seed = s;
    info = buildSample(s);
    fileName = `Built-in sample #${s}`;
  }

  async function onFile(e) {
    const f = e.currentTarget.files?.[0];
    if (!f) return;
    const buf = new Uint8Array(await f.arrayBuffer());
    try {
      info = parseVox(buf);
      fileName = f.name;
    } catch (err) {
      alert('Parse failed: ' + err.message);
    }
  }
</script>

<div style="padding:24px;display:flex;flex-direction:column;gap:16px;align-items:flex-start;">
  <h1 style="margin:0;font-size:20px;">@voxel-tool/svelte · Voxel Model Viewer</h1>
  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
    <button style={btn} onclick={regenerate}>Regenerate</button>
    <label style={btn}>
      Open .vox file
      <input type="file" accept=".vox" onchange={onFile} style="display:none;" />
    </label>
    <span style="color:#8b93a7;font-size:13px;">
      {fileName} · {info.models[0].voxels.length} voxels · {info.models[0].size.join('×')}
    </span>
  </div>

  <VoxViewer model={info.models[0]} palette={info.palette} size={[480, 480]} />

  <p style="color:#8b93a7;font-size:13px;max-width:520px;line-height:1.6;">
    Left-drag to rotate · scroll to zoom · right-drag to pan. The component uses real 3D rendering from Three.js
    (depth buffer + face culling), decoupled from <code>@voxel-tool/core</code>: pass either <code>src</code>
    (raw .vox bytes) or a parsed <code>{ model, palette }</code>.
  </p>
</div>
```

## Local preview

```bash
npm run dev:svelte   # -> http://localhost:5177
```

Source: [`packages/svelte/example/`](https://github.com/Maicarons/voxel-tool/tree/main/packages/svelte/example).

## Rendering principle (why it's more robust than Canvas2D)

- Every voxel is a real 3D cube, correctly occluded by the WebGL **depth buffer** (no sorting artifacts for concave shapes or adjacency).
- **Face culling**: only faces exposed to air are generated (6-neighbor check) — a 14582-voxel model measured only 6098 faces.
- **Orthographic isometric camera** `OrthographicCamera` at the `(+,+,+)` angle → the classic MagicaVoxel look.
- `HemisphereLight` + key/fill `DirectionalLight` shade by face normal.
- `OrbitControls` for free rotate / zoom / pan.
