// 体素布尔 CSG (并 / 交 / 差) —— 纯几何, 无 three 依赖, 可在 Node 直接单测.
//
// 体素是离散整数栅格, 因此布尔运算等价于对 VoxelGrid 的 "坐标键 -> 颜色索引" Map
// 做集合运算, 无需真正的网格 CSG (BSP / 边折叠). 这与 Qubicle 的布尔体素建模同构:
//   - union:        A ∪ B
//   - intersection: A ∩ B
//   - difference:   A \ B  (A 减 B)
//
// 颜色归属: 同一坐标被两侧同时占据时, 默认保留 A 的颜色 (colorTie:'a'); 可设 'b'.
// 输出网格尺寸取两侧各轴最大值, 因此 union 能容纳 B 超出 A 的部分; difference 中
// B 超出 A 的坐标本就不影响 A, 无需特殊处理.
import { VoxelGrid } from './voxel-grid.js';

/** 支持的布尔运算 */
export const CSG_OP = /** @type {const} */ ({
  UNION: 'union',
  INTERSECTION: 'intersection',
  DIFFERENCE: 'difference',
});

/**
 * 对两个体素网格执行布尔 CSG 运算.
 * @param {VoxelGrid} A 主操作数 (差集的被减对象)
 * @param {VoxelGrid} B 次操作数
 * @param {'union'|'intersection'|'difference'} op
 * @param {{ colorTie?: 'a'|'b' }} [options] 冲突处颜色归属, 默认 'a'
 * @returns {VoxelGrid}
 */
export function voxelCSG(A, B, op, options = {}) {
  if (!(A instanceof VoxelGrid) || !(B instanceof VoxelGrid)) {
    throw new TypeError('voxelCSG: A / B 必须是 VoxelGrid 实例');
  }
  if (!Object.values(CSG_OP).includes(op)) {
    throw new Error(`voxelCSG: 未知运算 "${op}" (应为 union|intersection|difference)`);
  }
  const tie = options.colorTie === 'b' ? 'b' : 'a';

  const sx = Math.max(A.sx, B.sx);
  const sy = Math.max(A.sy, B.sy);
  const sz = Math.max(A.sz, B.sz);
  const out = new VoxelGrid(sx, sy, sz);

  if (op === CSG_OP.UNION) {
    for (const [k, ci] of A.voxels) out.voxels.set(k, ci);
    for (const [k, ci] of B.voxels) if (!out.voxels.has(k)) out.voxels.set(k, ci);
  } else if (op === CSG_OP.INTERSECTION) {
    const [primary, secondary] = tie === 'b' ? [B, A] : [A, B];
    for (const [k, ci] of primary.voxels) {
      if (secondary.voxels.has(k)) out.voxels.set(k, ci);
    }
  } else {
    // difference: A \ B
    for (const [k, ci] of A.voxels) {
      if (!B.voxels.has(k)) out.voxels.set(k, ci);
    }
  }
  return out;
}

/**
 * 把另一种"坐标键 -> 颜色索引"表示 (如编辑器分层后的单层 Map) 转成 VoxelGrid.
 * 供 CLI / 编辑器在 CSG 前把任意体素表示规整为统一类型.
 * @param {Map<string, number>} map
 * @param {[number, number, number]} size
 * @returns {VoxelGrid}
 */
export function gridFromMap(map, size) {
  const g = new VoxelGrid(size[0], size[1], size[2]);
  for (const [k, ci] of map) g.voxels.set(k, ci);
  return g;
}
