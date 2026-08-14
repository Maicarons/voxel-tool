// 体素镜像坐标工具 (P4.6 对称笔刷的核心算法).
//
// 给定体素坐标 (x,y,z) 与包围盒尺寸 size=[sx,sy,sz], 按开启的对称轴生成所有
// 镜像坐标 (含原点本体). 这是体素网格坐标空间内的通用几何变换, 不依赖渲染层,
// 因此放在 @voxel-tool/core 而非编辑器 (编辑器只是它的一个消费方).
//
// 镜像平面取各轴的几何中心: coord' = (size[a] - 1) - coord[a].
// 同时开启多个轴时取所有"翻转组合" (2^k 个位置, k = 开启轴数), 自动去重.
//
// 注意: 本函数不做边界裁剪——镜像坐标可能落在 [-1, size) 之外 (例如靠近边缘的
// 体素镜像后越界). 边界合法性由消费方 (编辑器的 addVoxel 边界检查) 处理, 这样
// 算法保持纯函数、可被 Node 直接单测.

/**
 * 计算体素 (x,y,z) 在开启对称轴下的所有镜像坐标.
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {[number, number, number]} size 包围盒尺寸 [sx,sy,sz]
 * @param {{x?: boolean, y?: boolean, z?: boolean}} symmetry 各轴是否开启镜像 (省略=全关)
 * @returns {Array<[number, number, number]>} 去重后的坐标列表 (至少含原点本体 1 个)
 */
export function mirrorCoordinates(x, y, z, size, symmetry = {}) {
  const [sx, sy, sz] = size;
  const axes = [];
  if (symmetry.x) axes.push('x');
  if (symmetry.y) axes.push('y');
  if (symmetry.z) axes.push('z');

  const seen = new Set();
  const out = [];
  const push = (X, Y, Z) => {
    const k = `${X},${Y},${Z}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push([X, Y, Z]);
  };

  // 原点本体
  push(x, y, z);

  // 所有非空翻转组合 (每个开启轴最多翻转一次 -> 覆盖 2^k 个对称位置)
  const n = axes.length;
  for (let mask = 1; mask < (1 << n); mask++) {
    let X = x;
    let Y = y;
    let Z = z;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        const a = axes[i];
        if (a === 'x') X = (sx - 1) - X;
        else if (a === 'y') Y = (sy - 1) - Y;
        else Z = (sz - 1) - Z;
      }
    }
    push(X, Y, Z);
  }

  return out;
}
