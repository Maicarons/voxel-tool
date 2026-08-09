// Node 可跑的验证: 造模型 -> 写文件 -> 读回 -> 比对
import { writeFileSync, readFileSync } from 'node:fs';
import { VoxelGrid, toVoxBytes, parseVox, rainbowPalette } from './src/index.js';

function buildSample() {
  const grid = new VoxelGrid(40, 40, 44);
  // 灰底座
  for (let x = 4; x < 36; x++)
    for (let y = 4; y < 36; y++)
      for (let z = 0; z < 3; z++) grid.set(x, y, z, 255);
  // 彩虹球
  const cx = 20, cy = 20, cz = 24, R = 14;
  const zmin = cz - R, zmax = cz + R;
  grid.addSphere(cx, cy, cz, R, (dx, dy, dz) => {
    const frac = Math.max(0, Math.min(1, (dz + cz - zmin) / (zmax - zmin)));
    return 1 + Math.round(frac * 253);
  });
  return grid;
}

const grid = buildSample();
const palette = rainbowPalette();
const bytes = toVoxBytes(grid, palette);
writeFileSync('sample.vox', bytes);

const buf = readFileSync('sample.vox');
const info = parseVox(buf);

const written = new Set([...grid.voxels.entries()].map(([k, i]) => `${k}:${i}`));
const read = new Set(info.models[0].voxels.map((v) => `${v.x},${v.y},${v.z}:${v.i}`));

let palOk = true;
for (let i = 0; i < 256; i++) {
  const a = palette[i], b = info.palette[i];
  if (a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2] || a[3] !== b[3]) { palOk = false; break; }
}

console.log('写入字节数:', bytes.length);
console.log('version:', info.version);
console.log('model:', info.models[0].size, 'voxels:', info.models[0].voxels.length);
console.log('magic OK:', buf[0] === 0x56 && buf[1] === 0x4f && buf[2] === 0x58 && buf[3] === 0x20);
console.log('往返一致:', written.size === read.size && [...written].every((k) => read.has(k)));
console.log('调色板一致:', palOk);
console.log(written.size === read.size && palOk ? 'ALL OK' : 'FAIL');
