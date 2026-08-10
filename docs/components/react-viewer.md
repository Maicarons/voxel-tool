# Component Example · React VoxViewer

A complete, runnable React example: it builds a "gray base + rainbow sphere" model on the fly with `@voxel-tool/core`,
runs it through a write → read round-trip, hands it to `VoxViewer` for rendering, and also supports opening a local `.vox` file.

```jsx
// App.jsx
import React, { useMemo, useRef, useState } from 'react';
import { VoxViewer } from '@voxel-tool/react';
import { VoxelGrid, toVoxBytes, parseVox, rainbowPalette } from '@voxel-tool/core';

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

export default function App() {
  const [info, setInfo] = useState(() => buildSample(0));
  const [seed, setSeed] = useState(0);
  const [fileName, setFileName] = useState('Built-in sample (gray base + rainbow sphere)');
  const fileRef = useRef(null);

  const regenerate = () => {
    const s = (seed + 1) % 100;
    setSeed(s);
    setInfo(buildSample(s));
    setFileName(`Built-in sample #${s}`);
  };

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const buf = new Uint8Array(await f.arrayBuffer());
    try {
      setInfo(parseVox(buf));
      setFileName(f.name);
    } catch (err) {
      alert('Parse failed: ' + err.message);
    }
  };

  const model = info.models[0];

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start' }}>
      <h1 style={{ margin: 0, fontSize: 20 }}>@voxel-tool/react · Voxel Model Viewer</h1>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={regenerate}>Regenerate</button>
        <button onClick={() => fileRef.current?.click()}>Open .vox file</button>
        <input ref={fileRef} type="file" accept=".vox" onChange={onFile} style={{ display: 'none' }} />
        <span>{fileName} · {model.voxels.length} voxels · {model.size.join('×')}</span>
      </div>

      <VoxViewer model={model} palette={info.palette} />

      <p style={{ color: '#8b93a7', fontSize: 13, maxWidth: 520, lineHeight: 1.6 }}>
        Left-drag to rotate · scroll to zoom · right-drag to pan. The component uses real 3D rendering from Three.js
        (depth buffer + face culling) and is decoupled from <code>@voxel-tool/core</code>: you can pass either <code>src</code>
        (raw .vox bytes) or a parsed <code>{'{ model, palette }'}</code>.
      </p>
    </div>
  );
}
```

## Local preview

```bash
npm run dev:react   # -> http://localhost:5173
```

Source: [`packages/react/example/`](https://github.com/Maicarons/voxel-tool/tree/main/packages/react/example).

## Rendering principle (why it's more robust than Canvas2D)

- Every voxel is a real 3D cube, correctly occluded by the WebGL **depth buffer** (no sorting artifacts for concave shapes or adjacency).
- **Face culling**: only faces exposed to air are generated (6-neighbor check) — a 14582-voxel model measured only 6098 faces.
- **Orthographic isometric camera** `OrthographicCamera` at the `(+,+,+)` angle → the classic MagicaVoxel look.
- `HemisphereLight` + key/fill `DirectionalLight` shade by face normal.
- `OrbitControls` for free rotate / zoom / pan.
