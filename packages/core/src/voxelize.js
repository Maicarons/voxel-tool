// 把三角网格体素化为体素立方体阵列 (纯几何, 无 three 依赖, 可在 Node 直接单测).
//
// 用法:
//   import { voxelizeMesh } from '@voxel-tool/core';
//   const { grid, palette } = voxelizeMesh(triangles, { resolution: 64 });
//   const bytes = toVoxBytes(grid, palette); // -> .vox
//
// triangles: Array<{ a:[x,y,z], b:[x,y,z], c:[x,y,z], color?:[r,g,b,a] }>
//   color 为 0..255 每通道, 决定该三角形体素着色 (缺省用 options.color 统一色).
//
// 算法:
//   - shell 模式 (默认): 对每个三角形, 遍历其 AABB 覆盖的候选体素, 用分离轴定理 (SAT, 13 轴)
//     判定三角形是否与体素立方体相交, 命中即标记实心. 只保留表面壳, 不要求网格封闭.
//   - solid 模式: 对每个体素中心沿 +X 发射射线, 与三角形命中次数为奇数则判定为内部实心.
//     需要网格是封闭流形 (否则孔洞处会误判), 适合"实心块"建模.
import { VoxelGrid } from './voxel-grid.js';
import { defaultPalette } from './palette.js';

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

// 三角形 (v0,v1,v2) 与轴对齐立方体 (中心 c, 半长 h) 是否相交 (SAT, 13 个潜在分离轴).
function triBoxOverlap(c, h, v0, v1, v2) {
  // 平移到以立方体中心为原点, 简化投影计算
  const f0 = sub(v0, c);
  const f1 = sub(v1, c);
  const f2 = sub(v2, c);

  // 1) 立方体的三个坐标轴
  for (let axis = 0; axis < 3; axis++) {
    const p0 = f0[axis], p1 = f1[axis], p2 = f2[axis];
    const mn = Math.min(p0, p1, p2);
    const mx = Math.max(p0, p1, p2);
    if (mn > h[axis] || mx < -h[axis]) return false;
  }

  // 2) 三角形法线 + 9 个 边×轴 叉积轴
  const e0 = sub(f1, f0);
  const e1 = sub(f2, f1);
  const e2 = sub(f0, f2);
  const n = cross(e0, e1);
  const axes = [
    n,
    cross([1, 0, 0], e0), cross([1, 0, 0], e1), cross([1, 0, 0], e2),
    cross([0, 1, 0], e0), cross([0, 1, 0], e1), cross([0, 1, 0], e2),
    cross([0, 0, 1], e0), cross([0, 0, 1], e1), cross([0, 0, 1], e2),
  ];
  for (const a of axes) {
    if (Math.abs(a[0]) + Math.abs(a[1]) + Math.abs(a[2]) < 1e-12) continue; // 退化轴跳过
    const ra = h[0] * Math.abs(a[0]) + h[1] * Math.abs(a[1]) + h[2] * Math.abs(a[2]);
    const pa = Math.min(dot(f0, a), dot(f1, a), dot(f2, a));
    const pb = Math.max(dot(f0, a), dot(f1, a), dot(f2, a));
    if (pa > ra || pb < -ra) return false;
  }
  return true;
}

// 射线 (orig + t*dir, t>0) 与三角形 (a,b,c) 是否相交 (Möller–Trumbore, 仅正向命中).
function rayTriHit(ox, oy, oz, dx, dy, dz, a, b, c) {
  const e1 = sub(b, a);
  const e2 = sub(c, a);
  const pvec = cross([dx, dy, dz], e2);
  const det = dot(e1, pvec);
  if (Math.abs(det) < 1e-12) return false;
  const inv = 1 / det;
  const tvec = [ox - a[0], oy - a[1], oz - a[2]];
  const u = dot(tvec, pvec) * inv;
  if (u < 0 || u > 1) return false;
  const qvec = cross(tvec, e1);
  const v = dot([dx, dy, dz], qvec) * inv;
  if (v < 0 || u + v > 1) return false;
  const t = dot(e2, qvec) * inv;
  return t > 1e-9;
}

/**
 * 把三角网格体素化.
 * @param {Array<{a:[number,number,number],b:[number,number,number],c:[number,number,number],color?:[number,number,number,number]}>} triangles
 * @param {object} [options]
 * @param {number|number[]} [options.resolution=64] 网格最大维度分辨率 (标量) 或 [nx,ny,nz]
 * @param {'shell'|'solid'} [options.mode='shell'] shell=仅表面壳(不需封闭); solid=填充内部(需封闭流形)
 * @param {number} [options.pad=0] 包围盒外扩体素层数
 * @param {[number,number,number,number]} [options.color=[200,205,215,255]] 统一颜色 (三角形无 color 时)
 * @param {[[number,number,number],[number,number,number]]} [options.bounds] 显式包围盒 [[min],[max]], 默认从网格算
 * @returns {{ grid: VoxelGrid, palette: Array<[number,number,number,number]> }}
 */
export function voxelizeMesh(triangles, options = {}) {
  const {
    resolution = 64,
    mode = 'shell',
    pad = 0,
    color = [200, 205, 215, 255],
    bounds = null,
  } = options;

  if (!Array.isArray(triangles) || triangles.length === 0) {
    throw new Error('voxelizeMesh: triangles 不能为空');
  }

  // 包围盒
  const mn = [Infinity, Infinity, Infinity];
  const mx = [-Infinity, -Infinity, -Infinity];
  if (bounds) {
    for (let i = 0; i < 3; i++) { mn[i] = bounds[0][i]; mx[i] = bounds[1][i]; }
  } else {
    for (const t of triangles) {
      for (const v of [t.a, t.b, t.c]) {
        for (let i = 0; i < 3; i++) {
          if (v[i] < mn[i]) mn[i] = v[i];
          if (v[i] > mx[i]) mx[i] = v[i];
        }
      }
    }
  }

  const span = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];

  // 分辨率 -> 网格尺寸
  let size;
  if (Array.isArray(resolution)) {
    size = [
      Math.max(1, Math.round(resolution[0])),
      Math.max(1, Math.round(resolution[1])),
      Math.max(1, Math.round(resolution[2])),
    ];
  } else {
    const r = Math.max(1, Math.round(resolution));
    let longest = 0;
    for (let i = 0; i < 3; i++) if (span[i] > span[longest]) longest = i;
    size = [1, 1, 1];
    for (let i = 0; i < 3; i++) {
      if (span[i] < 1e-9) { size[i] = 1; continue; }
      size[i] = Math.max(1, Math.round((span[i] / span[longest]) * r));
    }
  }

  // 体素边长 (基于无 pad 包围盒)
  const vs = [
    span[0] < 1e-9 ? 1 : span[0] / size[0],
    span[1] < 1e-9 ? 1 : span[1] / size[1],
    span[2] < 1e-9 ? 1 : span[2] / size[2],
  ];

  // pad: 包围盒外扩 pad 层, 网格各轴 +2*pad
  const fpad = Math.max(0, Math.floor(pad));
  const fsize = [size[0] + 2 * fpad, size[1] + 2 * fpad, size[2] + 2 * fpad];
  const origin = [mn[0] - fpad * vs[0], mn[1] - fpad * vs[1], mn[2] - fpad * vs[2]];

  // 颜色量化 -> 调色板 (基于 defaultPalette 复制, 覆盖用到的索引)
  const palette = defaultPalette();
  const colorToCi = new Map();
  let nextCi = 1;
  const ciFor = (col) => {
    const c = (Array.isArray(col) && col.length >= 3)
      ? [col[0] | 0, col[1] | 0, col[2] | 0, col[3] === undefined ? 255 : col[3] | 0]
      : color;
    const key = c.join(',');
    const hit = colorToCi.get(key);
    if (hit !== undefined) return hit;
    let ci;
    if (nextCi <= 255) {
      ci = nextCi++;
    } else {
      // 超出 255 色: 最近匹配已分配色
      ci = 1; let best = Infinity;
      for (const [, v] of colorToCi) {
        const p = palette[v];
        const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
        if (d < best) { best = d; ci = v; }
      }
    }
    colorToCi.set(key, ci);
    palette[ci] = c;
    return ci;
  };

  const grid = new VoxelGrid(fsize[0], fsize[1], fsize[2]);
  const clampIdx = (val, max) => {
    const i = Math.floor(val);
    return i < 0 ? 0 : (i > max ? max : i);
  };

  if (mode === 'solid') {
    // 逐体素中心沿 +X 射线奇偶判定 (需封闭流形网格).
    // 退化处理: 体素中心恰好落在共享棱/对称平面上时, 射线会"压在边上"导致 Möller–Trumbore
    // 把命中判定为 u/v=0|1 而拒绝, 奇偶翻转漏标. 给垂直分量加微小非对称 jitter 打破退化.
    const ej = 1e-3 * vs[1];
    const ek = 2e-3 * vs[2];
    for (let i = 0; i < fsize[0]; i++) {
      const cx = origin[0] + (i + 0.5) * vs[0];
      for (let j = 0; j < fsize[1]; j++) {
        const cy = origin[1] + (j + 0.5) * vs[1] + ej;
        for (let k = 0; k < fsize[2]; k++) {
          const cz = origin[2] + (k + 0.5) * vs[2] + ek;
          let count = 0; let col = null;
          for (const t of triangles) {
            if (rayTriHit(cx, cy, cz, 1, 0, 0, t.a, t.b, t.c)) {
              count++;
              if (col === null) col = t.color || color;
            }
          }
          if (count & 1) grid.voxels.set(`${i},${j},${k}`, ciFor(col === null ? color : col));
        }
      }
    }
  } else {
    // shell: 每个三角形, 算其 AABB 体素范围, 测 tri-AABB 相交.
    // pad 语义: 最外 fpad 圈是"留空 margin", 不应因 SAT 接触判定被标成壳, 故跳过该圈.
    const half = [vs[0] * 0.5, vs[1] * 0.5, vs[2] * 0.5];
    for (const t of triangles) {
      const tmn = [
        Math.min(t.a[0], t.b[0], t.c[0]),
        Math.min(t.a[1], t.b[1], t.c[1]),
        Math.min(t.a[2], t.b[2], t.c[2]),
      ];
      const tmx = [
        Math.max(t.a[0], t.b[0], t.c[0]),
        Math.max(t.a[1], t.b[1], t.c[1]),
        Math.max(t.a[2], t.b[2], t.c[2]),
      ];
      // epsilon 外扩: 三角形端点恰好落在体素边界(如 x=1 面)时, 让其两侧相邻体素都进入候选,
      // 再由 SAT 判定实际接触. 否则会漏掉"紧贴表面的壳层"(尤其 pad 外扩后表面落在 margin 内侧).
      const EPS = 1e-6;
      const ix0 = clampIdx((tmn[0] - EPS - origin[0]) / vs[0], fsize[0] - 1);
      const ix1 = clampIdx((tmx[0] + EPS - origin[0]) / vs[0], fsize[0] - 1);
      const iy0 = clampIdx((tmn[1] - EPS - origin[1]) / vs[1], fsize[1] - 1);
      const iy1 = clampIdx((tmx[1] + EPS - origin[1]) / vs[1], fsize[1] - 1);
      const iz0 = clampIdx((tmn[2] - EPS - origin[2]) / vs[2], fsize[2] - 1);
      const iz1 = clampIdx((tmx[2] + EPS - origin[2]) / vs[2], fsize[2] - 1);
      const ci = ciFor(t.color || color);
      for (let i = ix0; i <= ix1; i++) {
        if (i < fpad || i >= size[0] + fpad) continue;
        const cx = origin[0] + (i + 0.5) * vs[0];
        for (let j = iy0; j <= iy1; j++) {
          if (j < fpad || j >= size[1] + fpad) continue;
          const cy = origin[1] + (j + 0.5) * vs[1];
          for (let k = iz0; k <= iz1; k++) {
            if (k < fpad || k >= size[2] + fpad) continue;
            const cz = origin[2] + (k + 0.5) * vs[2];
            const key = `${i},${j},${k}`;
            if (grid.voxels.has(key)) continue; // 已标记, 跳过加速
            if (triBoxOverlap([cx, cy, cz], half, t.a, t.b, t.c)) {
              grid.voxels.set(key, ci);
            }
          }
        }
      }
    }
  }

  return { grid, palette };
}
