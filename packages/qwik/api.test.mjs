// 框架组件包的公开 API 回归测试 (在 Node 环境下跑, 无需浏览器/WebGL):
// 1) 暴露了一个 VoxViewer 组件导出;
// 2) 从 @voxel-tool/viewer 正确 re-export 了 buildVoxelGeometry / createVoxelViewer;
// 3) buildVoxelGeometry 的「面剔除」逻辑正确 (这是 voxel viewer 的性能核心)。
//
// 注意: Qwik 的 component$ 必须由 Qwik Optimizer 在编译期改写, 裸导入库产物会在
// 运行时抛 "Optimizer should replace all usages of $()" 错误。这里桩掉
// @builder.io/qwik (列出 dist 实际 import 的命名导出), 仅验证包的导出形态
// (公开 API 回归), 不触发真实 Qwik 运行时。
import { vi } from 'vitest';

vi.mock('@builder.io/qwik', () => ({
  component$: (fn) => fn,
  useSignal: (v) => ({ value: v }),
  useStore: (v) => v ?? {},
  useTask$: (fn) => fn,
  useVisibleTask$: (fn) => fn,
}));

import { describe, it, expect } from 'vitest';
import { VoxViewer, buildVoxelGeometry, createVoxelViewer } from './dist/index.js';

const pal = Array.from({ length: 256 }, (_, i) => [i, i, i, 255]);

describe('@voxel-tool/qwik public API', () => {
  it('exposes a VoxViewer component export', () => {
    expect(VoxViewer).toBeTruthy();
  });

  it('re-exports viewer helpers', () => {
    expect(typeof buildVoxelGeometry).toBe('function');
    expect(typeof createVoxelViewer).toBe('function');
  });

  it('buildVoxelGeometry culls interior faces', () => {
    const single = buildVoxelGeometry([{ x: 0, y: 0, z: 0, i: 1 }], pal);
    expect(single.index.count / 6).toBe(6);

    const cube = [];
    for (let x = 0; x < 2; x++)
      for (let y = 0; y < 2; y++)
        for (let z = 0; z < 2; z++) cube.push({ x, y, z, i: 1 });
    const solid = buildVoxelGeometry(cube, pal);
    expect(solid.index.count / 6).toBe(24);
  });
});
