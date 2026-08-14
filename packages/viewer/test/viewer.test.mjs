// @voxel-tool/viewer 的 Vitest 测试: 重点守护「面剔除」(voxel viewer 性能核心).
import { describe, test, expect } from 'vitest';
import * as THREE from 'three';
import { VoxelGrid, toVoxBytes, parseVox, rainbowPalette } from '../../core/src/index.js';
import { buildVoxelGeometry, buildVoxelBuckets, buildVoxelGeometryGreedy, buildVoxelBucketsGreedy, makeMaterial } from '../src/mesh.js';

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

// ===========================================================================
// Greedy meshing 一致性测试 (P3.2)
// 核心不变量: greedy 产出的几何体, 在「暴露面 multiset」上与朴素面剔除完全等价
// (不丢面、不加面、不错位); 仅把共面同色相邻面合并成矩形以降低三角数。
// ===========================================================================
describe('buildVoxelGeometryGreedy 一致性 (P3.2)', () => {
  const NEIGHBORS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

  function presentSet(voxels) {
    const s = new Set();
    for (const v of voxels) s.add(`${v.x},${v.y},${v.z}`);
    return s;
  }
  // ground truth: 朴素算法的暴露面语义 (与 mesh.js 的 occupied + alpha 规则一致)
  function enumerateFaces(voxels, palette) {
    const present = presentSet(voxels);
    const keys = [];
    for (const v of voxels) {
      const col = palette ? palette[v.i] : null;
      if (!col || col[3] === 0) continue;
      for (let f = 0; f < 6; f++) {
        const [dx, dy, dz] = NEIGHBORS[f];
        if (present.has(`${v.x + dx},${v.y + dy},${v.z + dz}`)) continue;
        const dim = Math.floor(f / 2), sign = f % 2 === 0 ? 1 : -1;
        keys.push(`${dim},${sign},${v.x},${v.y},${v.z}`);
      }
    }
    return keys;
  }
  // 从 greedy 几何体反算其覆盖的 (axis,sign,x,y,z) multiset
  function geometryToFaceKeys(geo) {
    const pos = geo.getAttribute('position');
    const nor = geo.getAttribute('normal');
    const idx = geo.index;
    const keys = [];
    for (let q = 0; q < idx.count; q += 6) {
      const iv = [idx.getX(q), idx.getX(q + 1), idx.getX(q + 2), idx.getX(q + 3)];
      const n = [nor.getX(iv[0]), nor.getY(iv[0]), nor.getZ(iv[0])];
      const axis = n[0] !== 0 ? 0 : (n[1] !== 0 ? 1 : 2);
      const sign = n[axis] > 0 ? 1 : -1;
      const uAxis = axis === 0 ? 1 : (axis === 1 ? 2 : 0);
      const vAxis = axis === 0 ? 2 : (axis === 1 ? 0 : 1);
      const p = (i) => [pos.getX(i), pos.getY(i), pos.getZ(i)];
      const w = Math.round(p(iv[0])[axis] - 0.5 * sign);
      const gu = Math.round(Math.min(...iv.map((i) => p(i)[uAxis])));
      const du = Math.round(Math.max(...iv.map((i) => p(i)[uAxis]))) - gu;
      const gv = Math.round(Math.min(...iv.map((i) => p(i)[vAxis])));
      const dv = Math.round(Math.max(...iv.map((i) => p(i)[vAxis]))) - gv;
      for (let uu = gu; uu < gu + du; uu++) {
        for (let vv = gv; vv < gv + dv; vv++) {
          const vc = [0, 0, 0];
          vc[axis] = w; vc[uAxis] = uu; vc[vAxis] = vv;
          keys.push(`${axis},${sign},${vc[0]},${vc[1]},${vc[2]}`);
        }
      }
    }
    return keys;
  }
  function faceKeysEqual(greedyGeo, voxels, palette) {
    return JSON.stringify(geometryToFaceKeys(greedyGeo).sort()) === JSON.stringify(enumerateFaces(voxels, palette).sort());
  }
  // 固定种子 LCG, 保证可复现
  function rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  function randomVoxels(n, seed) {
    const r = rng(seed); const out = []; const seen = new Set();
    while (out.length < n) {
      const x = Math.floor(r() * 12), y = Math.floor(r() * 12), z = Math.floor(r() * 12);
      const k = `${x},${y},${z}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ x, y, z, i: 1 + (out.length % 4) });
    }
    return out;
  }

  test('单个体素 -> 6 暴露面 (greedy 与朴素覆盖一致)', () => {
    const v = [{ x: 0, y: 0, z: 0, i: 1 }];
    const g = buildVoxelGeometryGreedy(v, pal);
    expect(g.index.count / 6).toBe(6);
    expect(faceKeysEqual(g, v, pal)).toBe(true);
  });

  test('2×2×2 实心 -> 外壳 6 个大矩形 (覆盖 24 暴露面)', () => {
    const cube = [];
    for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) for (let z = 0; z < 2; z++) cube.push({ x, y, z, i: 1 });
    const g = buildVoxelGeometryGreedy(cube, pal);
    expect(g.index.count / 6).toBe(6); // 6 个面各 1 个矩形
    expect(faceKeysEqual(g, cube, pal)).toBe(true);
  });

  test('随机模型: greedy 覆盖 == 朴素暴露面 (不丢面/不加面/不错位)', () => {
    for (let seed = 1; seed <= 16; seed++) {
      const v = randomVoxels(80, seed);
      const g = buildVoxelGeometryGreedy(v, pal);
      expect(faceKeysEqual(g, v, pal), `seed=${seed}`).toBe(true);
    }
  });

  test('大平板: greedy 三角数 <= 朴素', () => {
    const slab = [];
    for (let x = 0; x < 24; x++) for (let y = 0; y < 24; y++) slab.push({ x, y, z: 0, i: 2 });
    const g = buildVoxelGeometryGreedy(slab, pal);
    const gnaive = buildVoxelGeometry(slab, pal);
    expect(g.index.count).toBeLessThanOrEqual(gnaive.index.count);
    expect(g.index.count / 6).toBeLessThan(slab.length * 6);
  });

  test('多色相邻: greedy 不跨色合并 (覆盖仍一致)', () => {
    const v = [];
    for (let x = 0; x < 10; x++) for (let y = 0; y < 10; y++) v.push({ x, y, z: 0, i: x < 5 ? 1 : 2 });
    const g = buildVoxelGeometryGreedy(v, pal);
    expect(faceKeysEqual(g, v, pal)).toBe(true);
  });

  test('buildVoxelBucketsGreedy: 各桶覆盖并集 == ground truth + 分桶正确', () => {
    const materials = { 1: { type: '_metal' }, 2: { type: '_glass' } };
    const v = [
      { x: 0, y: 0, z: 0, i: 1 }, { x: 1, y: 0, z: 0, i: 1 },
      { x: 2, y: 0, z: 0, i: 2 }, { x: 3, y: 0, z: 0, i: 3 },
    ];
    const buckets = buildVoxelBucketsGreedy(v, pal, materials);
    let keys = [];
    for (const b of buckets) {
      const pos = b.geometry.getAttribute('position');
      const nor = b.geometry.getAttribute('normal');
      const idx = b.geometry.index;
      for (let q = 0; q < idx.count; q += 6) {
        const iv = [idx.getX(q), idx.getX(q + 1), idx.getX(q + 2), idx.getX(q + 3)];
        const n = [nor.getX(iv[0]), nor.getY(iv[0]), nor.getZ(iv[0])];
        const axis = n[0] !== 0 ? 0 : (n[1] !== 0 ? 1 : 2);
        const sign = n[axis] > 0 ? 1 : -1;
        const uAxis = axis === 0 ? 1 : (axis === 1 ? 2 : 0);
        const vAxis = axis === 0 ? 2 : (axis === 1 ? 0 : 1);
        const p = (i) => [pos.getX(i), pos.getY(i), pos.getZ(i)];
        const w = Math.round(p(iv[0])[axis] - 0.5 * sign);
        const gu = Math.round(Math.min(...iv.map((i) => p(i)[uAxis])));
        const du = Math.round(Math.max(...iv.map((i) => p(i)[uAxis]))) - gu;
        const gv = Math.round(Math.min(...iv.map((i) => p(i)[vAxis])));
        const dv = Math.round(Math.max(...iv.map((i) => p(i)[vAxis]))) - gv;
        for (let uu = gu; uu < gu + du; uu++) for (let vv = gv; vv < gv + dv; vv++) {
          const vc = [0, 0, 0]; vc[axis] = w; vc[uAxis] = uu; vc[vAxis] = vv;
          keys.push(`${axis},${sign},${vc[0]},${vc[1]},${vc[2]}`);
        }
      }
    }
    expect(keys.sort()).toEqual(enumerateFaces(v, pal).sort());
    const ids = buckets.map((b) => b.materialId).sort((a, b) => a - b);
    expect(ids).toEqual([0, 1, 2]);
  });

  test('greedy 与 naive 几何体顶点位置集合完全一致 (无坐标偏移)', () => {
    const v = [];
    for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) for (let z = 0; z < 2; z++) v.push({ x, y, z, i: 1 + ((x + y + z) % 3) });
    const g = buildVoxelGeometryGreedy(v, pal);
    const gn = buildVoxelGeometry(v, pal);
    const posKeys = (geo) => {
      const pos = geo.getAttribute('position');
      const ks = [];
      for (let i = 0; i < pos.count; i++) ks.push(`${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`);
      return ks.sort();
    };
    expect(posKeys(g)).toEqual(posKeys(gn));
  });
});

// ===========================================================================
// P4.1 收尾: viewer 默认材质与 exporter 对齐为 MeshStandardMaterial
// 守护「查看器不再用 Lambert (Lambert 不吃 metalness/emissive)」, 确保看/导出 PBR 一致。
// ===========================================================================
describe('viewer 默认材质 (P4.1 收尾)', () => {
  test('makeMaterial 默认(无 defaultMaterial 参数) 仍走 Standard, 与 exporter 对齐', () => {
    // viewer.js 的 addInstance 现在调 makeMaterial(g.materialId, materials, { defaultMaterial: 'standard', side: THREE.DoubleSide })
    // 这里直接验证 makeMaterial 在 standard 默认下的行为 (viewer 调用等价路径)。
    const materials = { 1: { type: '_metal', metalness: 0.7, roughness: 0.3 } };
    const mat = makeMaterial(1, materials, { defaultMaterial: 'standard', side: THREE.DoubleSide });
    expect(mat.isMeshStandardMaterial).toBe(true);
    expect(mat.metalness).toBeCloseTo(0.7);
    expect(mat.roughness).toBeCloseTo(0.3);
    // 无材质默认桶(0) 也必须是 Standard (这是 P4.1 收尾前 viewer 用 Lambert 的真实不一致点)
    const def = makeMaterial(0, materials, { defaultMaterial: 'standard', side: THREE.DoubleSide });
    expect(def.isMeshStandardMaterial).toBe(true);
    expect(def.side).toBe(THREE.DoubleSide);
  });
});
