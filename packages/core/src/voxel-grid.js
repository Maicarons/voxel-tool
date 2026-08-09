// VoxelGrid: 体素容器, 与 Python 版同构
export class VoxelGrid {
  constructor(sx, sy, sz) {
    this.sx = sx;
    this.sy = sy;
    this.sz = sz;
    this.voxels = new Map(); // key "x,y,z" -> colorIndex
  }

  _key(x, y, z) {
    return `${x},${y},${z}`;
  }

  set(x, y, z, ci) {
    if (x < 0 || y < 0 || z < 0 || x >= this.sx || y >= this.sy || z >= this.sz) {
      throw new RangeError(`voxel (${x},${y},${z}) 超出边界 ${this.sx}x${this.sy}x${this.sz}`);
    }
    if (ci < 0 || ci > 255) throw new RangeError('颜色索引必须 0..255');
    this.voxels.set(this._key(x, y, z), ci);
  }

  addSphere(cx, cy, cz, r, ciFn) {
    const r2 = r * r;
    for (let x = Math.max(0, Math.floor(cx - r)); x < Math.min(this.sx, Math.ceil(cx + r)); x++) {
      for (let y = Math.max(0, Math.floor(cy - r)); y < Math.min(this.sy, Math.ceil(cy + r)); y++) {
        for (let z = Math.max(0, Math.floor(cz - r)); z < Math.min(this.sz, Math.ceil(cz + r)); z++) {
          const dx = x - cx, dy = y - cy, dz = z - cz;
          if (dx * dx + dy * dy + dz * dz <= r2) {
            this.set(x, y, z, ciFn(dx, dy, dz, Math.sqrt(dx * dx + dy * dy + dz * dz)));
          }
        }
      }
    }
  }

  get length() {
    return this.voxels.size;
  }

  // 返回有序数组 [{x,y,z,i}]
  list() {
    const out = [];
    for (const [key, i] of this.voxels) {
      const [x, y, z] = key.split(',').map(Number);
      out.push({ x, y, z, i });
    }
    out.sort((a, b) => a.x - b.x || a.y - b.y || a.z - b.z || a.i - b.i);
    return out;
  }
}
