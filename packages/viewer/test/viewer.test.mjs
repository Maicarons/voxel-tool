// @voxel-tool/viewer 的 Vitest 测试: 重点守护「面剔除」(voxel viewer 性能核心).
import { describe, test, expect } from 'vitest';
import { VoxelGrid, toVoxBytes, parseVox, rainbowPalette } from '../../core/src/index.js';
import { buildVoxelGeometry, buildVoxelBuckets } from '../src/mesh.js';

const pal = rainbowPalette();

function buildSample() {
  const grid = new VoxelGrid(40, 40, 44);
  for (let x = 4; x < 36; x++)
    for (let y = 4; y < 36; y++)
      for (let z = 0; z < 3; z++) grid.set(x, y, z, 255);
  const cx = 20, cy = 20, cz = 24, R = 14;
  grid.addSphere(cx, cy, cz, R, (dx, dy, dz) => 1 + Math.round(((dz + R) / (2 * R)) * 253));
  return parseVox(toVoxBytes(grid, pal));
}

describe('buildVoxelGeometry 面剔除', () => {
  test('单个体素 -> 6 个暴露面', () => {
    const g = buildVoxelGeometry([{ x: 0, y: 0, z: 0, i: 1 }], pal);
    expect(g.index.count / 6).toBe(6);
  });

  test('2×2×2 实心 -> 仅外壳 24 面(内部面全部剔除)', () => {
    const cube = [];
    for (let x = 0; x < 2; x++)
      for (let y = 0; y < 2; y++)
        for (let z = 0; z < 2; z++) cube.push({ x, y, z, i: 1 });
    const g = buildVoxelGeometry(cube, pal);
    expect(g.index.count / 6).toBe(24);
  });

  test('真实模型: 面数远小于 6×体素数 + 包围盒存在', () => {
    const info = buildSample();
    const m = info.models[0];
    const g = buildVoxelGeometry(m.voxels, info.palette);
    const faces = g.index.count / 6;
    expect(info.version).toBe(150);
    expect(m.voxels.length).toBeGreaterThan(0);
    expect(faces).toBeLessThan(m.voxels.length * 6);
    expect(g.getAttribute('position').count).toBeGreaterThan(0);
    expect(g.boundingBox).not.toBeNull();
  });

  test('alpha=0 的调色板项被跳过(不产生面)', () => {
    const g = buildVoxelGeometry([{ x: 0, y: 0, z: 0, i: 0 }], pal); // i=0 -> 透明
    expect(g.index.count).toBe(0);
  });
});

describe('buildVoxelBuckets 材质分桶', () => {
  test('无材质 -> 单一 materialId=0 桶', () => {
    const buckets = buildVoxelBuckets([{ x: 0, y: 0, z: 0, i: 1 }], pal, {});
    expect(buckets.length).toBe(1);
    expect(buckets[0].materialId).toBe(0);
  });

  test('按调色板索引分桶: 有材质 -> 专属桶; 无材质 -> 默认桶 0', () => {
    const materials = { 1: { type: '_metal' }, 2: { type: '_glass' } };
    const buckets = buildVoxelBuckets(
      [
        { x: 0, y: 0, z: 0, i: 1 }, // 有材质
        { x: 1, y: 0, z: 0, i: 2 }, // 有材质
        { x: 2, y: 0, z: 0, i: 1 }, // 有材质
        { x: 3, y: 0, z: 0, i: 3 }, // 无材质 -> 默认桶 0
      ],
      pal,
      materials,
    );
    const ids = buckets.map((b) => b.materialId).sort((a, b) => a - b);
    expect(ids).toEqual([0, 1, 2]);
  });
});
