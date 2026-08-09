// viewer/src/mesh.js —— 框架无关的体素网格构造 (基于 Three.js BufferGeometry)
//
// 实现「正经 voxel viewer」的核心原理 (参考 threejs-vox-loader / coding.kiwi 的
// Rendering .vox Files):
//   1) 每个体素是真实 3D 立方体, 靠 WebGL 深度缓冲正确遮挡 —— 不再用画家算法排序;
//   2) 面剔除 (face culling): 只生成「暴露在空气里」的面 (邻接 6 方向检查),
//      把 6×N 个面砍到只剩外壳, 大模型也能秒渲;
//   3) 顶点色 (vertex colors): 一个 MeshLambertMaterial 即可承载全部颜色。
//
// 坐标系: MagicaVoxel 本地坐标 x 右 / y 前 / z 上; 构造完成后整体 rotateX(-90°)
// 把 z-up 转到 Three.js 的 y-up, 同时法线被一并旋转, 光照正确。
import * as THREE from 'three';

// 立方体 6 个面: 法线 + 4 个局部角 (立方体半边长 0.5, 中心在体素原点)
const FACES = [
  { n: [1, 0, 0],  c: [[0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5], [0.5, -0.5, 0.5]] },
  { n: [-1, 0, 0], c: [[-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5], [-0.5, -0.5, -0.5]] },
  { n: [0, 1, 0],  c: [[-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5]] },
  { n: [0, -1, 0], c: [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5]] },
  { n: [0, 0, 1],  c: [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]] },
  { n: [0, 0, -1], c: [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5]] },
];
// 与上面一一对应的 6 个邻接方向 (体素空间)
const NEIGHBORS = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
];

const key = (x, y, z) => x + ',' + y + ',' + z;

/**
 * 把体素列表构造成一个合并的 BufferGeometry (仅暴露面 + 顶点色)。
 * @param {{x:number,y:number,z:number,i:number}[]} voxels
 * @param {number[][]|null} palette 256 项 [r,g,b,a] (0..255); null 时退化为灰
 * @returns {THREE.BufferGeometry}
 */
export function buildVoxelGeometry(voxels, palette) {
  // 1) 占用集合, 用于邻接剔除
  const occupied = new Set();
  for (const v of voxels) occupied.add(key(v.x, v.y, v.z));

  const positions = [];
  const normals = [];
  const colors = [];
  const indices = [];
  let base = 0;

  for (const v of voxels) {
    const col = palette ? palette[v.i] : null;
    if (!col || col[3] === 0) continue; // alpha=0 视为透明, 跳过
    const r = col[0] / 255, g = col[1] / 255, b = col[2] / 255;
    for (let f = 0; f < 6; f++) {
      const [dx, dy, dz] = NEIGHBORS[f];
      // 邻接方向被占用 -> 该面被遮挡, 直接剔除 (性能关键)
      if (occupied.has(key(v.x + dx, v.y + dy, v.z + dz))) continue;
      const face = FACES[f];
      for (const corner of face.c) {
        positions.push(v.x + corner[0], v.y + corner[1], v.z + corner[2]);
        normals.push(face.n[0], face.n[1], face.n[2]);
        colors.push(r, g, b);
      }
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
      base += 4;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  // z-up -> three y-up (det=+1 的纯旋转, 法线随之正确)
  geo.rotateX(-Math.PI / 2);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}
