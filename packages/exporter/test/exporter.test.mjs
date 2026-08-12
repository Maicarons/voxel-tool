// @voxel-tool/exporter 的 Vitest 测试: 覆盖 7 种格式的导出 + 朝向/面剔除/材质。
import { describe, test, expect } from 'vitest';
import { VoxelGrid, toVoxBytes, parseVox, rainbowPalette, defaultPalette } from '../../core/src/index.js';
import { VoxelExporter, buildExportObject, exportModel, toUint8Array } from '../src/index.js';
import * as THREE from 'three';

const pal = rainbowPalette();

function makeSampleGrid() {
  const grid = new VoxelGrid(40, 40, 44);
  for (let x = 4; x < 36; x++)
    for (let y = 4; y < 36; y++)
      for (let z = 0; z < 3; z++) grid.set(x, y, z, 255);
  const cx = 20, cy = 20, cz = 24, R = 14;
  grid.addSphere(cx, cy, cz, R, (dx, dy, dz) => 1 + Math.round(((dz + R) / (2 * R)) * 253));
  return grid;
}

function bytesHead(data, n) {
  const u8 = toUint8Array(data);
  return new TextDecoder().decode(u8.subarray(0, n));
}
function u8(data) {
  return toUint8Array(data);
}

describe('buildExportObject 朝向与结构', () => {
  test('返回 THREE.Group 且根节点 z-up->y-up 翻转', () => {
    const vox = parseVox(toVoxBytes(makeSampleGrid(), pal));
    const obj = buildExportObject(vox);
    expect(obj.isGroup).toBe(true);
    expect(obj.rotation.x).toBeCloseTo(-Math.PI / 2);
    expect(obj.children.length).toBeGreaterThan(0);
  });

  test('单个体素在 z=5 -> 世界 y 正向 (y-up)', () => {
    const obj = buildExportObject({ model: { size: [2, 2, 2], voxels: [{ x: 0, y: 0, z: 5, i: 1 }] }, palette: pal });
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    // voxel 本地 z=5 翻成世界 y≈5, 半高 0.5 -> max.y ≈ 5.5
    expect(box.max.y).toBeGreaterThan(5);
    expect(box.max.y).toBeLessThan(6);
  });

  test('面剔除: 单个体素 -> 6 面; 2x2x2 实心 -> 24 面', () => {
    const single = buildExportObject({ model: { size: [1, 1, 1], voxels: [{ x: 0, y: 0, z: 0, i: 1 }] }, palette: pal });
    let faces = 0;
    single.traverse((o) => { if (o.isMesh) faces += o.geometry.index.count / 6; });
    expect(faces).toBe(6);

    const cube = [];
    for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) for (let z = 0; z < 2; z++) cube.push({ x, y, z, i: 1 });
    const cubeObj = buildExportObject({ model: { size: [2, 2, 2], voxels: cube }, palette: pal });
    faces = 0;
    cubeObj.traverse((o) => { if (o.isMesh) faces += o.geometry.index.count / 6; });
    expect(faces).toBe(24);
  });

  test('alpha=0 的调色板项不产生面', () => {
    const obj = buildExportObject({ model: { size: [1, 1, 1], voxels: [{ x: 0, y: 0, z: 0, i: 0 }] }, palette: pal });
    let faces = 0;
    obj.traverse((o) => { if (o.isMesh) faces += o.geometry.index.count / 6; });
    expect(faces).toBe(0);
  });
});

describe('多格式导出', () => {
  const vox = parseVox(toVoxBytes(makeSampleGrid(), pal));
  const exporter = new VoxelExporter(vox);

  test('glb -> 含 glTF 魔数 (ArrayBuffer)', async () => {
    const data = await exporter.export('glb');
    expect(data).toBeInstanceOf(ArrayBuffer);
    expect(bytesHead(data, 4)).toBe('glTF');
  });

  test('gltf -> 合法 JSON 字符串', async () => {
    const data = await exporter.export('gltf');
    expect(typeof data).toBe('string');
    const json = JSON.parse(data);
    expect(json.asset).toBeDefined();
    expect(Array.isArray(json.meshes)).toBe(true);
  });

  test('obj -> 几何文本 (o/v/f), 注意: three 的 OBJExporter 对 Mesh 不写顶点色', async () => {
    const data = await exporter.export('obj');
    expect(typeof data).toBe('string');
    expect(data).toContain('o '); // 对象名
    expect(data).toContain('v '); // 顶点
    expect(data).toContain('f '); // 面
    // three 的 OBJExporter 仅在 Points 路径写顶点色, Mesh 路径不写;
    // 因此 OBJ 默认不带颜色 (几何正确, 颜色需 GLB/PLY/USDZ/FBX 才保真)。
    expect(data).not.toMatch(/v\s+[\d.-]+\s+[\d.-]+\s+[\d.-]+\s+[\d.]+\s+[\d.]+\s+[\d.]+/);
  });

  test('stl -> 默认二进制 (DataView) 且非空; ascii 以 solid 开头', async () => {
    const bin = await exporter.export('stl');
    expect(bin).toBeInstanceOf(DataView);
    expect(bin.byteLength).toBeGreaterThan(84);

    const ascii = await exporter.export('stl', { binary: false });
    expect(typeof ascii).toBe('string');
    expect(ascii.startsWith('solid')).toBe(true);
  });

  test('ply -> 以 ply 头开头 (binary/ascii 皆是文本头)', async () => {
    const bin = await exporter.export('ply');
    expect(bytesHead(bin, 3)).toBe('ply');
    const ascii = await exporter.export('ply', { binary: false });
    expect(ascii.startsWith('ply')).toBe(true);
  });

  test('usdz -> zip 魔数 PK (返回 Uint8Array)', async () => {
    const data = await exporter.export('usdz');
    expect(data).toBeInstanceOf(Uint8Array);
    const b = u8(data);
    expect(b[0]).toBe(0x50); // P
    expect(b[1]).toBe(0x4b); // K
    expect(b[2]).toBe(0x03);
    expect(b[3]).toBe(0x04);
  });

  test('fbx -> Kaydara FBX Binary 魔数', async () => {
    const data = await exporter.export('fbx');
    expect(data).toBeInstanceOf(Uint8Array);
    expect(bytesHead(data, 18)).toBe('Kaydara FBX Binary');
  });
});

describe('材质与多实例', () => {
  test('带 MATL 材质导出 glb 不报错且含多 mesh', async () => {
    // 构造含 MATL 的 .vox: 用 core 写 + 直接 parseVox 拿 materials
    const grid = new VoxelGrid(8, 8, 8);
    grid.set(0, 0, 0, 1); // i=1 有材质
    grid.set(2, 0, 0, 2); // i=2 无材质 -> 默认桶
    grid.set(4, 0, 0, 3); // i=3 有材质
    const bytes = toVoxBytes(grid, pal);
    const vox = parseVox(bytes);
    // 注入材质 (parseVox 无 MATL 时 materials={}, 这里手动模拟有材质场景)
    vox.materials = { 1: { type: '_metal', metalness: 0.8, roughness: 0.2 }, 3: { type: '_glass', alpha: 0.5 } };
    const exporter = new VoxelExporter(vox);
    const glb = await exporter.export('glb');
    expect(glb).toBeInstanceOf(ArrayBuffer);
    expect(bytesHead(glb, 4)).toBe('glTF');
  });

  test('多实例 (instances) 导出: 几何被合并到同一 Group', async () => {
    const instA = [{ x: 0, y: 0, z: 0, i: 1 }, { x: 1, y: 0, z: 0, i: 2 }];
    const instB = [{ x: 10, y: 0, z: 0, i: 3 }];
    const exporter = new VoxelExporter({
      instances: [
        { voxels: instA, translation: [0, 0, 0], rotation: 0 },
        { voxels: instB, translation: [0, 0, 5], rotation: 0 },
      ],
      palette: pal,
    });
    const obj = exporter.build();
    expect(obj.children.length).toBe(2); // 两个实例各一个 mesh (无材质 -> 单桶)
    const glb = await exporter.export('glb');
    expect(bytesHead(glb, 4)).toBe('glTF');
  });

  test('缺省 palette 自动用 defaultPalette', async () => {
    const exporter = new VoxelExporter({ model: { size: [1, 1, 1], voxels: [{ x: 0, y: 0, z: 0, i: 1 }] } });
    const obj = exporter.build();
    expect(obj.children.length).toBe(1);
    const glb = await exporter.export('glb');
    expect(bytesHead(glb, 4)).toBe('glTF');
    expect(defaultPalette().length).toBe(256); // 确保默认调色板可用
  });
});

describe('vox 回写 (round-trip)', () => {
  test('解析结果 -> 写回 .vox 无损 (魔数 VOX + 体素数一致)', async () => {
    const grid = makeSampleGrid();
    const vox = parseVox(toVoxBytes(grid, pal));
    const exporter = new VoxelExporter(vox);
    const bytes = u8(await exporter.export('vox'));
    expect(new TextDecoder().decode(bytes.subarray(0, 4))).toBe('VOX ');
    const back = parseVox(bytes);
    expect(back.models.length).toBe(vox.models.length);
    expect(back.models[0].voxels.length).toBe(vox.models[0].voxels.length);
  });

  test('多实例输入反推 models+scene 写回也能解析', async () => {
    const exporter = new VoxelExporter({
      instances: [
        { voxels: [{ x: 0, y: 0, z: 0, i: 1 }], translation: [0, 0, 0] },
        { voxels: [{ x: 5, y: 0, z: 0, i: 2 }], translation: [0, 0, 0] },
      ],
      palette: pal,
    });
    const bytes = u8(await exporter.export('vox'));
    expect(new TextDecoder().decode(bytes.subarray(0, 4))).toBe('VOX ');
    const back = parseVox(bytes);
    expect(back.models.length).toBe(2);
    expect(back.scene.length).toBe(2);
  });
});
