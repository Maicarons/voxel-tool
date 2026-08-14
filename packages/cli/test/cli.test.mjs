// test/cli.test.mjs —— Node headless 导出 CLI 测试.
// 直接 import 核心库 exportVoxFile (与 exporter 测试同进程, three 已在该环境跑通),
// 不再 spawn 子进程, 避免继承 vitest worker 的 NODE_OPTIONS loader 干扰 three 动态导入.
import { test, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { exportVoxFile, listFormats, FORMATS, voxelizeModel, csgVoxFiles } from '../src/export.mjs';
import { VoxelGrid, toVoxBytes, parseVox } from '@voxel-tool/core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');
const sample = resolve(repoRoot, 'packages/core/sample.vox');

test('listFormats 返回全部 8 种格式 (含 vox 回写)', () => {
  expect(listFormats()).toEqual(expect.arrayContaining(['glb', 'gltf', 'obj', 'stl', 'ply', 'usdz', 'fbx', 'vox']));
  expect(FORMATS.length).toBe(8);
});

test('导出 glb 且魔数正确', async () => {
  const outDir = resolve(__dirname, '.tmp');
  mkdirSync(outDir, { recursive: true });
  const out = resolve(outDir, 'out.glb');
  const { outputPath, bytes } = await exportVoxFile(sample, { format: 'glb', output: out });
  expect(Buffer.from(bytes.subarray(0, 4)).toString('ascii')).toBe('glTF');
  expect(readFileSync(outputPath).subarray(0, 4).toString('ascii')).toBe('glTF');
  rmSync(outDir, { recursive: true, force: true });
});

test('省略 format 时默认导出 glb', async () => {
  const outDir = resolve(__dirname, '.tmp');
  mkdirSync(outDir, { recursive: true });
  const out = resolve(outDir, 'def.glb');
  const { bytes } = await exportVoxFile(sample, { output: out });
  expect(Buffer.from(bytes.subarray(0, 4)).toString('ascii')).toBe('glTF');
  rmSync(outDir, { recursive: true, force: true });
});

test('不支持的格式抛错', async () => {
  await expect(exportVoxFile(sample, { format: 'xyz' })).rejects.toThrow('不支持的格式');
});

test('导出 vox (round-trip) 且魔数正确', async () => {
  const outDir = resolve(__dirname, '.tmp');
  mkdirSync(outDir, { recursive: true });
  const out = resolve(outDir, 'rt.vox');
  const { outputPath, bytes } = await exportVoxFile(sample, { format: 'vox', output: out });
  expect(Buffer.from(bytes.subarray(0, 4)).toString('ascii')).toBe('VOX ');
  expect(readFileSync(outputPath).subarray(0, 4).toString('ascii')).toBe('VOX ');
  rmSync(outDir, { recursive: true, force: true });
});

test('导出 glb -d (Draco) 体积小于未压缩且含 KHR_draco_mesh_compression', async () => {
  const outDir = resolve(__dirname, '.tmp');
  mkdirSync(outDir, { recursive: true });
  const plain = resolve(outDir, 'plain.glb');
  const draco = resolve(outDir, 'draco.glb');

  const a = await exportVoxFile(sample, { format: 'glb', output: plain });
  const b = await exportVoxFile(sample, { format: 'glb', output: draco, draco: true });

  // 压缩后更小
  expect(b.bytes.length).toBeLessThan(a.bytes.length);

  // 含 Draco 扩展声明
  const buf = readFileSync(draco);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const jsonLen = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf.buffer, buf.byteOffset + 20, jsonLen)));
  expect(json.extensionsUsed).toContain('KHR_draco_mesh_compression');
  rmSync(outDir, { recursive: true, force: true });
});

test('逆向体素化: sample.vox -> glb -> vox 闭环 (P4.5)', async () => {
  const outDir = resolve(__dirname, '.tmp');
  mkdirSync(outDir, { recursive: true });
  const glb = resolve(outDir, 'roundtrip.glb');
  const vox = resolve(outDir, 'roundtrip.vox');

  // 1) 正向: sample.vox -> glb
  await exportVoxFile(sample, { format: 'glb', output: glb });
  expect(readFileSync(glb).subarray(0, 4).toString('ascii')).toBe('glTF');

  // 2) 逆向: glb -> vox (shell 模式, 分辨率 32)
  const { outputPath, bytes } = await voxelizeModel(glb, { output: vox, resolution: 32 });
  expect(readFileSync(outputPath).subarray(0, 4).toString('ascii')).toBe('VOX ');
  // 体素化产物非空且体积合理 (header + 至少一个 voxel chunk)
  expect(bytes.length).toBeGreaterThan(40);

  rmSync(outDir, { recursive: true, force: true });
});

test('逆向体素化: 手写 ASCII STL -> vox (shell 模式)', async () => {
  const outDir = resolve(__dirname, '.tmp');
  mkdirSync(outDir, { recursive: true });
  const stl = resolve(outDir, 'cube.stl');
  const vox = resolve(outDir, 'cube.vox');
  const tri = (p, q, r) =>
    '  facet normal 0 0 0\n    outer loop\n      vertex ' +
    p.join(' ') + '\n      vertex ' + q.join(' ') + '\n      vertex ' + r.join(' ') +
    '\n    endloop\n  endfacet\n';
  const solid = 'solid cube\n' + tri([-1, -1, 0], [1, -1, 0], [0, 1, 0]) + 'endsolid cube\n';
  writeFileSync(stl, solid);

  const { outputPath, bytes } = await voxelizeModel(stl, { output: vox, mode: 'shell', resolution: 16 });
  expect(readFileSync(outputPath).subarray(0, 4).toString('ascii')).toBe('VOX ');
  expect(bytes.length).toBeGreaterThan(40);

  rmSync(outDir, { recursive: true, force: true });
});

// ---- 布尔 CSG (P4.6 余下) ----
function writeVox(path, size, entries) {
  const g = new VoxelGrid(size[0], size[1], size[2]);
  for (const [x, y, z, ci] of entries) g.set(x, y, z, ci);
  writeFileSync(path, Buffer.from(toVoxBytes(g)));
}

test('CSG union: 两个错位立方体合并, 体素数相加', async () => {
  const outDir = resolve(__dirname, '.tmp');
  mkdirSync(outDir, { recursive: true });
  const a = resolve(outDir, 'a.vox');
  const b = resolve(outDir, 'b.vox');
  const out = resolve(outDir, 'union.vox');
  writeVox(a, [2, 1, 1], [[0, 0, 0, 10]]);
  writeVox(b, [2, 1, 1], [[1, 0, 0, 20]]);

  const { outputPath, count } = await csgVoxFiles(a, b, 'union', { output: out });
  expect(readFileSync(outputPath).subarray(0, 4).toString('ascii')).toBe('VOX ');
  expect(count).toBe(2); // a(1) + b(1)，不重合
  rmSync(outDir, { recursive: true, force: true });
});

test('CSG difference: 从 a 减去与 b 重合部分', async () => {
  const outDir = resolve(__dirname, '.tmp');
  mkdirSync(outDir, { recursive: true });
  const a = resolve(outDir, 'a.vox');
  const b = resolve(outDir, 'b.vox');
  const out = resolve(outDir, 'diff.vox');
  writeVox(a, [2, 1, 1], [[0, 0, 0, 10], [1, 0, 0, 11]]);
  writeVox(b, [2, 1, 1], [[1, 0, 0, 20]]);

  const { outputPath, count } = await csgVoxFiles(a, b, 'difference', { output: out });
  const parsed = parseVox(readFileSync(outputPath));
  expect(count).toBe(1);
  expect(parsed.models[0].voxels.map((v) => `${v.x},${v.y},${v.z}`)).toEqual(['0,0,0']);
  rmSync(outDir, { recursive: true, force: true });
});

test('CSG 未知运算抛错', async () => {
  const outDir = resolve(__dirname, '.tmp');
  mkdirSync(outDir, { recursive: true });
  const a = resolve(outDir, 'a.vox');
  const b = resolve(outDir, 'b.vox');
  writeVox(a, [2, 1, 1], [[0, 0, 0, 10]]);
  writeVox(b, [2, 1, 1], [[1, 0, 0, 20]]);
  await expect(csgVoxFiles(a, b, 'xor', { output: resolve(outDir, 'x.vox') })).rejects.toThrow('不支持的 CSG');
  rmSync(outDir, { recursive: true, force: true });
});
