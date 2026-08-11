# @voxel-tool/exporter

Standalone voxel-model exporter for Node and the browser. Convert MagicaVoxel `.vox` (or raw voxel data + palette) into general-purpose 3D formats, built on the official Three.js exporters.

This package is part of the [`voxel-tool`](https://github.com/Maicarons/voxel-tool) monorepo and is published alongside `@voxel-tool/core`, `@voxel-tool/viewer`, and the framework bindings.

## Supported formats

| Format | Extension | Color / material fidelity |
|---|---|---|
| **GLB** | `.glb` | Vertex colors + PBR (best fidelity) |
| **glTF** | `.gltf` | Vertex colors + PBR (JSON) |
| **OBJ** | `.obj` | Geometry only — Three's `OBJExporter` does **not** emit vertex colors for meshes (only for `Points`), so OBJ carries no color |
| **STL** | `.stl` | No color (ideal for 3D printing); ascii or binary |
| **PLY** | `.ply` | Vertex colors; ascii or binary |
| **USDZ** | `.usdz` | Vertex colors + PBR (single-sided materials) |
| **FBX** | `.fbx` | Vertex colors via [`@comfyorg/fbx-exporter-three`](https://www.npmjs.com/package/@comfyorg/fbx-exporter-three); PBR is approximated (Lambert/Phong) |

GLTF/GLB/OBJ/STL/PLY/USDZ are produced by Three.js built-in exporters; only FBX requires the third-party library (bundled as a dependency, not optional).

## Why a standalone package?

Voxel geometry is built with face-culling (only air-exposed faces) and merged into a single buffer with **vertex colors corrected from sRGB to linear** (so exports match what you see on screen). The export object is a `y-up` `THREE.Group` (the voxel-local `z-up` space is flipped to match Blender/Unity).

## Install

```bash
npm install @voxel-tool/exporter three
```

`three` is a peer/regular dependency and must be installed by the consumer (the package externalizes it so it is not duplicated).

## Usage

### From a parsed `.vox` (Node)

```js
import { readFileSync, writeFileSync } from 'node:fs';
import { parseVox } from '@voxel-tool/core';
import { VoxelExporter } from '@voxel-tool/exporter';

const vox = parseVox(readFileSync('model.vox'));
const exporter = new VoxelExporter(vox);

writeFileSync('model.glb', Buffer.from(await exporter.export('glb'))); // ArrayBuffer
writeFileSync('model.fbx', await exporter.export('fbx'));              // Uint8Array
```

### Pure data (no `@voxel-tool/core` needed)

```js
import { VoxelExporter, buildExportObject, exportModel } from '@voxel-tool/exporter';

const input = {
  instances: [
    { voxels: [{ x: 0, y: 0, z: 0, i: 1 }, { x: 1, y: 0, z: 0, i: 2 }] },
  ],
  palette,   // 256 × [r,g,b,a], or omit to use the default palette
  materials, // optional: { 1: { metalness: 0.8, roughness: 0.2 }, ... }
};

const exporter = new VoxelExporter(input);
const objText = await exporter.export('obj');     // string
const stl = await exporter.export('stl');         // DataView (binary)
const ply = await exporter.export('ply', { binary: false }); // string (ascii)
```

### In the browser (download)

```js
const exporter = new VoxelExporter(vox);
await exporter.download('glb'); // saves model.glb
await exporter.download('obj', { filename: 'my-model.obj' });
```

## API

- `class VoxelExporter(input)` — `build()`, `export(format, options?)`, `toBlob(format, options?)`, `download(format, options?)`
- `buildExportObject(input)` → `THREE.Group` (the y-up export object; reuse it for your own rendering too)
- `exportModel(object3d, format, options?)` → `Promise<string | ArrayBuffer | Uint8Array | DataView>`
- `toBlob(data, mime?)`, `toUint8Array(data)`, `downloadModel(data, filename, mime?)`
- Constants: `FORMATS`, `DEFAULT_FILENAMES`, `MIME_TYPES`

`input` accepts three shapes: a `parseVox` result (`{ models, scene, palette?, materials? }`), a single model (`{ model, palette?, materials? }`), or explicit instances (`{ instances, palette?, materials? }`).

## Notes / limitations

- **OBJ has no vertex colors** (Three's mesh path omits them) — use GLB/PLY/USDZ/FBX when color matters.
- **STL has no color** by design (for printing).
- **FBX** is a third-party binary format; PBR materials are approximated. Prefer **GLB** for maximum fidelity.
- Color is exported in linear space and converted to sRGB by the target importer; the source palette is treated as sRGB.

## License

MIT
