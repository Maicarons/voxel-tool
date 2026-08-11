// 框架组件包的公开 API 回归测试 (在 Node 环境下跑, 无需浏览器/WebGL):
// 1) 暴露了一个 VoxViewer 组件导出;
// 2) 从 @voxel-tool/viewer 正确 re-export 了 buildVoxelGeometry / createVoxelViewer;
// 3) buildVoxelGeometry 的「面剔除」逻辑正确 (这是 voxel viewer 的性能核心)。
//
// 注意: Solid 的编译产物会在模块顶层调用 solid-js/web 的客户端 API (template/insert
// 等), 在纯 Node 端会抛 "Client-only API called on the server side"。这里桩掉
// solid-js/web 让模块能正常加载, 仅验证包的导出形态 (公开 API 回归), 不渲染组件。
import { vi } from 'vitest';

vi.mock('solid-js/web', () => ({
  insert: () => {},
  memo: (fn) => fn,
  effect: () => {},
  setStyleProperty: () => {},
  use: () => {},
  template: () => ({}),
}));

import { describe, it, expect } from 'vitest';
import { VoxViewer, buildVoxelGeometry, createVoxelViewer } from './dist/index.js';

const pal = Array.from({ length: 256 }, (_, i) => [i, i, i, 255]);

describe('@voxel-tool/solid public API', () => {
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
