// 24 个保向符号置换旋转矩阵 (标准集合, 与 MagicaVoxel 用同一组矩阵, 仅索引顺序约定不同).
// 用于把 nTRN 的 _r 索引换算成 3x3 矩阵做显示合成; 写回时我们保留原始整数索引,
// 因此无论本表顺序如何, 真实 .vox 文件的往返都无损且能被 MagicaVoxel 正确解释.
export const ROTATION_MATRICES = (() => {
  const axes = [
    [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
  ];
  const out = [];
  const seen = new Set();
  for (const x of axes) {
    for (const y of axes) {
      if (x[0] * y[0] + x[1] * y[1] + x[2] * y[2] !== 0) continue; // 必须正交
      const z = [
        x[1] * y[2] - x[2] * y[1],
        x[2] * y[0] - x[0] * y[2],
        x[0] * y[1] - x[1] * y[0],
      ];
      const m = [x[0], x[1], x[2], y[0], y[1], y[2], z[0], z[1], z[2]];
      const k = m.join(',');
      if (!seen.has(k)) { seen.add(k); out.push(m); }
    }
  }
  return out;
})();

export function matMul3(a, b) {
  const r = new Array(9);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let s = 0;
      for (let k = 0; k < 3; k++) s += a[i * 3 + k] * b[k * 3 + j];
      r[i * 3 + j] = s;
    }
  }
  return r;
}

export function matVec3(m, v) {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

// 找到与给定 3x3 矩阵最接近的 ROTATION_MATRICES 索引 (精确整数匹配)
export function rotationIndex(m) {
  const target = m.map((n) => Math.round(n)).join(',');
  for (let i = 0; i < ROTATION_MATRICES.length; i++) {
    if (ROTATION_MATRICES[i].join(',') === target) return i;
  }
  return 0;
}
