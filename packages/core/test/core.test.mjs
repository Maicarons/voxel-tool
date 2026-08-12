// @voxel-tool/core 的 Vitest 回归测试.
// 重点守护 0.2.0 的新能力: .vox 场景图(nTRN/nGRP/nSHP) + MATL 材质无损往返.
import { describe, test, expect } from 'vitest';
import {
  VoxelGrid,
  toVoxBytes,
  toVoxBytesScene,
  parseVox,
  ROTATION_MATRICES,
  rainbowPalette,
  defaultPalette,
} from '../src/index.js';

function makePalette() {
  const p = Array.from({ length: 256 }, () => [0, 0, 0, 0]);
  for (let i = 1; i < 256; i++) p[i] = [(i * 7) & 255, (i * 13) & 255, (i * 29) & 255, 255];
  return p;
}

function buildModel(seed, n) {
  const voxels = [];
  for (let k = 0; k < n; k++) {
    voxels.push({
      x: (seed + k) % 8,
      y: (seed * 2 + k) % 8,
      z: (seed * 3 + k) % 8,
      i: ((seed + k) % 200) + 1,
    });
  }
  return { size: [8, 8, 8], voxels };
}

describe('VoxelGrid', () => {
  test('set 增加体素, list 可枚举并保留颜色索引', () => {
    const g = new VoxelGrid(10, 10, 10);
    expect(g.length).toBe(0);
    g.set(1, 2, 3, 42);
    expect(g.length).toBe(1);
    const found = g.list().find((v) => v.x === 1 && v.y === 2 && v.z === 3);
    expect(found.i).toBe(42);
  });

  test('set 越界抛 RangeError', () => {
    const g = new VoxelGrid(10, 10, 10);
    expect(() => g.set(10, 0, 0, 1)).toThrow(RangeError);
    expect(() => g.set(0, 0, 0, 300)).toThrow(RangeError);
  });

  test('addSphere 生成非空体素', () => {
    const g = new VoxelGrid(40, 40, 44);
    g.addSphere(20, 20, 24, 14, () => 200);
    expect(g.list().length).toBeGreaterThan(0);
  });
});

describe('palette', () => {
  test('rainbowPalette 长度 256 且首元素透明', () => {
    const p = rainbowPalette();
    expect(p.length).toBe(256);
    expect(p[0][3]).toBe(0);
  });

  test('defaultPalette 长度 256', () => {
    expect(defaultPalette().length).toBe(256);
  });
});

describe('parseVox 单模型(向后兼容)', () => {
  test('toVoxBytes -> parseVox 往返一致 + 自动 identity 实例', () => {
    const grid = new VoxelGrid(8, 8, 8);
    grid.set(0, 0, 0, 1);
    grid.set(7, 7, 7, 2);
    const palette = makePalette();
    const bytes = toVoxBytes(grid, palette);
    const info = parseVox(bytes);

    expect(info.version).toBe(150);
    expect(info.models.length).toBe(1);
    expect(info.models[0].voxels.length).toBe(2);
    // 无场景图的老文件 -> 每个模型一个 identity 实例
    expect(info.scene.length).toBe(1);
    expect(info.scene[0]).toMatchObject({ modelIndex: 0, translation: [0, 0, 0], rotation: 0 });
    // 调色板往返
    expect(info.palette[1]).toEqual(palette[1]);
  });

  test('非法文件抛出', () => {
    const bad = new Uint8Array([0, 1, 2, 3, 0, 0, 0, 0]);
    expect(() => parseVox(bad)).toThrow();
  });
});

describe('场景图 + 材质 无损往返 (0.2.0 核心)', () => {
  const palette = makePalette();
  const models = [buildModel(1, 30), buildModel(5, 40)];
  const scene = [
    { modelIndex: 0, translation: [0, 0, 0], rotation: 0, hidden: false, name: 'A' },
    { modelIndex: 1, translation: [10, 0, 0], rotation: 6, hidden: false, name: 'B' },
  ];
  const materials = {
    10: { type: '_metal', metalness: 0.8, roughness: 0.3, alpha: 1, emissive: 0 },
    20: { type: '_glass', metalness: 0, roughness: 0.1, alpha: 0.5, emissive: 0.2 },
  };
  const bytes = toVoxBytesScene({ models, scene, materials }, palette);
  const back = parseVox(bytes);

  test('models 数量与体素一致', () => {
    expect(back.models.length).toBe(2);
    expect(back.models[0].voxels).toEqual(models[0].voxels);
    expect(back.models[1].voxels).toEqual(models[1].voxels);
  });

  test('scene 数组无损', () => {
    expect(back.scene).toEqual(scene);
  });

  test('materials 无损', () => {
    expect(back.materials).toEqual(materials);
  });

  test('ROTATION_MATRICES 恰为 24 个正交符号置换矩阵', () => {
    expect(ROTATION_MATRICES.length).toBe(24);
    for (const m of ROTATION_MATRICES) {
      expect(m.length).toBe(9);
      // 行列式应为 +1 (保向)
      const det =
        m[0] * (m[4] * m[8] - m[5] * m[7]) -
        m[1] * (m[3] * m[8] - m[5] * m[6]) +
        m[2] * (m[3] * m[7] - m[4] * m[6]);
      expect(det).toBe(1);
    }
  });

  test('legacy 无场景图 -> 自动生成单 identity 实例', () => {
    const legacy = parseVox(toVoxBytesScene({ models: [buildModel(2, 25)] }, palette));
    expect(legacy.scene.length).toBe(1);
    expect(legacy.scene[0].modelIndex).toBe(0);
  });
});

describe('动画 FRAM + nTRN 关键帧 无损往返 (P3 动画)', () => {
  const palette = makePalette();
  const models = [buildModel(1, 30), buildModel(5, 40), buildModel(9, 20)];
  // A: 沿 x 平移 4 帧; B: 旋转 4 帧(平移不变); C: 静态对象(动画文件里不运动)
  const scene = [
    {
      modelIndex: 0,
      translation: [0, 0, 0],
      rotation: 0,
      hidden: false,
      name: 'A',
      frames: [
        { translation: [0, 0, 0], rotation: 0 },
        { translation: [2, 0, 0], rotation: 0 },
        { translation: [4, 0, 0], rotation: 0 },
        { translation: [6, 0, 0], rotation: 0 },
      ],
    },
    {
      modelIndex: 1,
      translation: [10, 0, 0],
      rotation: 0,
      hidden: false,
      name: 'B',
      frames: [
        { translation: [10, 0, 0], rotation: 0 },
        { translation: [10, 0, 0], rotation: 1 },
        { translation: [10, 0, 0], rotation: 2 },
        { translation: [10, 0, 0], rotation: 3 },
      ],
    },
    { modelIndex: 2, translation: [0, 0, 5], rotation: 6, hidden: false, name: 'C' },
  ];
  const bytes = toVoxBytesScene({ models, scene, frameCount: 4 }, palette);
  const p1 = parseVox(bytes);

  test('frameCount 解析正确', () => {
    expect(p1.frameCount).toBe(4);
  });

  test('FRAM + 嵌套 _f 关键帧被解析为逐帧世界变换', () => {
    expect(p1.scene[0].frames).toEqual([
      { translation: [0, 0, 0], rotation: 0 },
      { translation: [2, 0, 0], rotation: 0 },
      { translation: [4, 0, 0], rotation: 0 },
      { translation: [6, 0, 0], rotation: 0 },
    ]);
    expect(p1.scene[1].frames.map((f) => f.rotation)).toEqual([0, 1, 2, 3]);
    // 旋转不改变根变换平移
    expect(p1.scene[1].frames.every((f) => f.translation.join(',') === '10,0,0')).toBe(true);
  });

  test('动画文件里的静态对象不附加 frames (保持无损)', () => {
    expect(p1.scene[2].frames).toBeUndefined();
  });

  test('二次往返场景结构完全一致 (writer->reader->writer->reader)', () => {
    const bytes2 = toVoxBytesScene(
      { models: p1.models, scene: p1.scene, materials: p1.materials, frameCount: p1.frameCount },
      p1.palette,
    );
    const p2 = parseVox(bytes2);
    expect(p2.frameCount).toBe(p1.frameCount);
    expect(p2.scene).toEqual(p1.scene);
    expect(p2.models).toEqual(p1.models);
  });
});
