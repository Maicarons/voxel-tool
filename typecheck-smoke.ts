import {
  parseVox,
  toVoxBytesScene,
  VoxelGrid,
  ROTATION_MATRICES,
  rainbowPalette,
} from '@voxel-tool/core';
import { createVoxelViewer, buildVoxelGeometry, makeMaterial } from '@voxel-tool/viewer';
import { VoxelExporter, buildExportObject, exportModel, FORMATS } from '@voxel-tool/exporter';
import type * as THREE from 'three';

const grid = new VoxelGrid(8, 8, 8);
grid.set(0, 0, 0, 1);
const pal = rainbowPalette();
const bytes = toVoxBytesScene(
  { models: [{ size: [8, 8, 8], voxels: grid.list() }] },
  pal,
);
const info = parseVox(bytes);
const scene = info.scene;
const mats = info.materials;
const rot: number[][] = ROTATION_MATRICES;

function useViewer(el: HTMLElement) {
  const v = createVoxelViewer(el, {
    instances: info.models.map((m) => ({ voxels: m.voxels, translation: [0, 0, 0], rotation: 0 })),
    palette: info.palette,
    materials: info.materials,
    onInfo: (x) => {
      if (x) console.log(x[0]);
    },
  });
  v.update({ model: info.models[0] });
  v.setBackground('#000');
  v.dispose();
}

const geo = buildVoxelGeometry(info.models[0].voxels, info.palette);
const mat: THREE.Material = makeMaterial(0, info.materials);

// @voxel-tool/exporter 消费端类型校验 (验证 .d.ts 可解析)
const exporter = new VoxelExporter(info);
const built: THREE.Group = exporter.build();
const exportPromise = exporter.export('glb'); // Promise<string | ArrayBuffer | Uint8Array | DataView>
const obj: THREE.Group = buildExportObject({ model: info.models[0], palette: info.palette });
const fmt: string[] = FORMATS;
void exportModel; void built; void obj; void fmt; void exportPromise;

console.log(scene.length, Object.keys(mats).length, rot.length, geo.attributes.position.count, mat.type, FORMATS.length);
