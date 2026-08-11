# @voxel-tool/exporter

A standalone export library that turns voxel models (`.vox` / raw voxel data) into general-purpose 3D file formats. Built on Three.js's built-in exporters plus a third-party FBX writer — **published alongside the other `@voxel-tool/*` packages**.

```js
import { VoxelExporter, FORMATS } from '@voxel-tool/exporter';
import { parseVox } from '@voxel-tool/core';

const { models, palette } = parseVox(bytes);
const exporter = new VoxelExporter(models[0]); // or { models, scene } / { instances }
const glb = await exporter.export('glb');      // ArrayBuffer (downloadable)
await exporter.download('obj');                // triggers a browser download
```

## Supported formats

| Format | Extension | Color | Geometry | Notes |
|---|---|---|---|---|
| `glb` | `.glb` | vertex colors | binary glTF | recommended for engines / web |
| `gltf` | `.gltf` | vertex colors | JSON glTF | text, easy to inspect |
| `obj` | `.obj` | **no** | mesh only | Three's `OBJExporter` writes geometry only (no vertex colors) |
| `stl` | `.stl` | **no** | binary | ideal for 3D printing |
| `ply` | `.ply` | vertex colors | binary | point-cloud friendly |
| `usdz` | `.usdz` | vertex colors | zip (USD) | AR on Apple platforms |
| `fbx` | `.fbx` | vertex colors | binary FBX | via `@comfyorg/fbx-exporter-three` (bundled) |

> **Vertex colors:** present in `glb` / `gltf` / `ply` / `usdz` / `fbx`. `obj` and `stl` carry geometry only — that is a limitation of the underlying Three.js exporters, not a bug.

## `VoxelExporter`

The high-level entry point.

```js
const exporter = new VoxelExporter(input);
```

`input` accepts any of the shapes described in [Input](#input). It is normalized once and cached.

| Method | Returns | Description |
|---|---|---|
| `build()` | `THREE.Group` | Builds (and caches) the y-up export object |
| `export(format, options?)` | `Promise<string \| ArrayBuffer \| Uint8Array \| DataView>` | Exports to the given format |
| `toBlob(format, options?)` | `Promise<Blob>` | Exports and wraps the result in a `Blob` |
| `download(format, options?)` | `Promise<void>` | Exports and triggers a browser download |

`options` is forwarded to the underlying exporter, plus two helpers:

- `binary` (default `true`) — for `stl` / `ply`, choose binary vs ASCII.
- `filename` — for `download`, the file name (extension auto-supplied by the format).

## Lower-level helpers

| Function | Description |
|---|---|
| `buildExportObject(input)` | Builds a y-up `THREE.Group` from voxel data (same algorithm as the viewer, with sRGB→linear vertex-color correction) |
| `exportModel(object3d, format, options?)` | Dispatches one format on an existing `THREE.Object3D` |
| `toBlob(data, mime?)` | Normalizes any export result into a `Blob` |
| `toUint8Array(data)` | Normalizes into a `Uint8Array` (Node file writing / magic-number checks) |
| `downloadModel(data, filename, mime?)` | Browser download (throws outside a browser) |
| `FORMATS` | `string[]` of all supported formats |
| `DEFAULT_FILENAMES` | `Record<format, string>` (e.g. `{ glb: 'model.glb' }`) |
| `MIME_TYPES` | `Record<format, string>` recommended MIME types |

## Input

```ts
interface VoxelExportInput {
  models?: VoxelModel[];
  scene?: Array<{ modelIndex: number; translation?; rotation?; hidden?; name? }>;
  instances?: VoxelInstance[];
  model?: VoxelModel | null;
  palette?: number[][] | null;   // 256 entries [r,g,b,a]; defaults to defaultPalette()
  materials?: Record<number, Material>;
}
```

Three sources, pick one:

1. **Parsed VOX** — `{ models, scene, palette?, materials? }` straight from `parseVox`.
2. **Single model** — `{ model: { size, voxels }, palette?, materials? }`.
3. **Explicit instances** — `{ instances: [{ voxels, translation?, rotation?, hidden?, name? }], palette?, materials? }`.

`palette` is a 256-entry RGBA array; if `null`/omitted the MagicaVoxel default palette is used. `materials` maps MATL ids to PBR properties and is only needed for `.vox` files that use materials.

## Notes

- **Orientation:** voxel data is z-up (MagicaVoxel space); the root `Group` applies `rotation.x = -π/2`, so the exported model stands upright in Blender / Unity / Godot.
- **Color fidelity:** palette entries are sRGB but Three stores vertex colors as linear, so the exporter applies an sRGB→linear conversion when building geometry. What you see in the viewer/editor is what you get in the export.
- **FBX** is emitted with `preset: 'threejs'` and `axisUp: 'Y'` so it matches the y-up orientation of the other formats.

## Example: export from the editor

The bundled **Voxel Editor** uses this package for its "导出模型" (Export Model) toolbar — select a format (GLB / glTF / OBJ / STL / PLY / USDZ / FBX) and download the current model. See [Voxel Editor](/editor).
