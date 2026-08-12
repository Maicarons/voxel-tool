import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  buildVoxelGeometry,
  buildVoxelGeometryGreedy,
  buildVoxelBuckets,
  makeMaterial,
  composeWorldMatrix,
} from '../src/index.js';

// palette: 256 entries [r,g,b,a]; index 0 transparent, 1 gray, 2 red
const palette = [
  [0, 0, 0, 0],
  [128, 128, 128, 255],
  [255, 0, 0, 255],
];

describe('@voxel-tool/mesh shared geometry', () => {
  it('isolated voxel -> 6 faces = 24 vertices / 36 index entries', () => {
    const geo = buildVoxelGeometry([{ x: 0, y: 0, z: 0, i: 1 }], palette);
    // 6 面 x 4 顶点(非索引存储) = 24 position; 6 面 x 6 索引 = 36 index
    expect(geo.getAttribute('position').count).toBe(24);
    expect(geo.index.count).toBe(36);
    expect(geo.getAttribute('color')).toBeTruthy();
  });

  it("colorSpace 'linear' darkens sRGB gray (128) to ~0.216, 'raw' keeps 0.502", () => {
    const raw = buildVoxelGeometry([{ x: 0, y: 0, z: 0, i: 1 }], palette, { colorSpace: 'raw' });
    const lin = buildVoxelGeometry([{ x: 0, y: 0, z: 0, i: 1 }], palette, { colorSpace: 'linear' });
    const rRaw = raw.getAttribute('color').array[0];
    const rLin = lin.getAttribute('color').array[0];
    expect(rRaw).toBeCloseTo(128 / 255, 4);
    expect(rLin).toBeLessThan(rRaw);
    expect(rLin).toBeGreaterThan(0.15);
    expect(rLin).toBeLessThan(0.25);
  });

  it('adjacent voxels: greedy triangle count <= naive', () => {
    const vox = [
      { x: 0, y: 0, z: 0, i: 2 },
      { x: 1, y: 0, z: 0, i: 2 },
    ];
    const naive = buildVoxelGeometry(vox, palette);
    const greedy = buildVoxelGeometryGreedy(vox, palette);
    // three 把 index 存在 geometry.index (不在 attributes 里); 用 .index 读取
    expect(greedy.index.count).toBeLessThanOrEqual(naive.index.count);
  });

  it('buildVoxelBuckets yields at least one bucket with geometry', () => {
    const buckets = buildVoxelBuckets([{ x: 0, y: 0, z: 0, i: 1 }], palette, undefined);
    expect(Array.isArray(buckets)).toBe(true);
    expect(buckets.length).toBeGreaterThanOrEqual(1);
    expect(buckets[0].geometry.getAttribute('position').count).toBeGreaterThan(0);
  });

  it('makeMaterial default lambert/DoubleSide; opts switch to standard/FrontSide', () => {
    const def = makeMaterial(0, undefined);
    expect(def).toBeInstanceOf(THREE.MeshLambertMaterial);
    expect(def.side).toBe(THREE.DoubleSide);
    const std = makeMaterial(0, undefined, { defaultMaterial: 'standard', side: THREE.FrontSide });
    expect(std).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(std.side).toBe(THREE.FrontSide);
  });

  it('composeWorldMatrix writes translation into last column', () => {
    const R = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    const m = composeWorldMatrix(R, [1, 2, 3]);
    const e = m.elements; // three Matrix4.elements is column-major; translation at [12,13,14]
    expect(e[12]).toBeCloseTo(1);
    expect(e[13]).toBeCloseTo(2);
    expect(e[14]).toBeCloseTo(3);
  });
});
