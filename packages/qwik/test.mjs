// Qwik 包的纯逻辑验证 (无需浏览器):
// 验证 buildVoxelGeometry 的「面剔除」是否正确 —— 这是正经 voxel viewer 的性能核心。
// 通过相对路径直接引用 @voxel-tool/viewer 与 @voxel-tool/core 源码, 避免依赖其 dist 产物。
import { VoxelGrid, toVoxBytes, parseVox, rainbowPalette } from '../core/src/index.js';
import { buildVoxelGeometry } from '../viewer/src/mesh.js';

const pal = rainbowPalette();
let ok = true;
const fail = (msg) => { console.error('✗ ' + msg); ok = false; };

function buildSample() {
  const grid = new VoxelGrid(40, 40, 44);
  for (let x = 4; x < 36; x++) for (let y = 4; y < 36; y++) for (let z = 0; z < 3; z++) grid.set(x, y, z, 255);
  const cx = 20, cy = 20, cz = 24, R = 14;
  grid.addSphere(cx, cy, cz, R, (dx, dy, dz) => 1 + Math.round(((dz + R) / (2 * R)) * 253));
  return parseVox(toVoxBytes(grid, pal));
}

// 1) 单个体素 -> 6 个暴露面
const g1 = buildVoxelGeometry([{ x: 0, y: 0, z: 0, i: 1 }], pal);
const f1 = g1.index.count / 6;
console.log(`单个体素: ${f1} 面`);
if (f1 !== 6) fail(`单体素应为 6 面, 实际 ${f1}`);

// 2) 2×2×2 实心 -> 仅外壳 24 面
const cube = [];
for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) for (let z = 0; z < 2; z++) cube.push({ x, y, z, i: 1 });
const g2 = buildVoxelGeometry(cube, pal);
const f2 = g2.index.count / 6;
console.log(`2×2×2 实心: ${f2} 面 (应为 24)`);
if (f2 !== 24) fail(`2x2x2 应为 24 面, 实际 ${f2}`);

// 3) 真实模型: 面数应远小于 6×体素数 (剔除生效)
const info = buildSample();
const m = info.models[0];
const g3 = buildVoxelGeometry(m.voxels, info.palette);
const f3 = g3.index.count / 6;
const verts = g3.getAttribute('position').count;
console.log(`sample: ${m.voxels.length} 体素 -> ${f3} 面, ${verts} 顶点, version=${info.version}`);
if (!(info.version === 150)) fail('version != 150');
if (!(m.voxels.length > 0)) fail('无体素');
if (!(f3 < m.voxels.length * 6)) fail('面剔除未生效 (面数未小于 6×体素数)');
if (!(verts > 0 && g3.boundingBox)) fail('几何未正确生成/包围盒缺失');

console.log(ok ? 'QWIK MESH OK' : 'QWIK MESH FAILED');
process.exit(ok ? 0 : 1);
