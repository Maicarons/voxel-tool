// test/cli.test.mjs —— Node headless 导出 CLI 测试.
// 直接 import 核心库 exportVoxFile (与 exporter 测试同进程, three 已在该环境跑通),
// 不再 spawn 子进程, 避免继承 vitest worker 的 NODE_OPTIONS loader 干扰 three 动态导入.
import { test, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync, rmSync, mkdirSync } from 'node:fs';
import { exportVoxFile, listFormats, FORMATS } from '../src/export.mjs';

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
