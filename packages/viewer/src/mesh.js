// viewer/src/mesh.js —— 框架无关的体素网格构造 (基于 Three.js BufferGeometry)
//
// 原理 (参考 threejs-vox-loader / coding.kiwi 的 Rendering .vox Files):
//   1) 每个体素是真实 3D 立方体, 靠 WebGL 深度缓冲正确遮挡;
//   2) 面剔除 (face culling): 只生成暴露在空气里的面 (邻接 6 方向检查);
//   3) 顶点色 (vertex colors): 一个材质即可承载全部颜色.
//
// 注意: 这里构造的几何体处于 **voxel 本地空间 (z-up)**, 不再内置 rotateX.
// 整体 z-up -> three y-up 的旋转由 viewer 的根 Group 统一施加, 这样多实例的世界
// 变换(平移/旋转)才能与全局朝向正确合成.
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
 * 把体素列表构造成一个合并的 BufferGeometry (仅暴露面 + 顶点色), 处于 voxel 本地空间.
 * @param {{x:number,y:number,z:number,i:number}[]} voxels
 * @param {number[][]|null} palette 256 项 [r,g,b,a] (0..255); null 时退化为灰
 * @returns {THREE.BufferGeometry}
 */
export function buildVoxelGeometry(voxels, palette) {
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
      if (occupied.has(key(v.x + dx, v.y + dy, v.z + dz))) continue; // 被遮挡, 剔除
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
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * 按材质把体素分桶, 每个桶一个几何体 + 材质 id.
 * 没有对应材质的体素进入 materialId=0 (默认材质) 桶.
 * @returns {Array<{ geometry: THREE.BufferGeometry, materialId: number }>}
 */
export function buildVoxelBuckets(voxels, palette, materials) {
  const hasMaterials = materials && Object.keys(materials).length > 0;
  const buckets = new Map(); // materialId -> { positions, normals, colors, indices, base }
  const occupied = new Set();
  for (const v of voxels) occupied.add(key(v.x, v.y, v.z));

  const getBucket = (mid) => {
    if (!buckets.has(mid)) buckets.set(mid, { positions: [], normals: [], colors: [], indices: [], base: 0 });
    return buckets.get(mid);
  };

  for (const v of voxels) {
    const col = palette ? palette[v.i] : null;
    if (!col || col[3] === 0) continue;
    const mid = hasMaterials && materials[v.i] ? v.i : 0;
    const b = getBucket(mid);
    const r = col[0] / 255, g = col[1] / 255, bch = col[2] / 255;
    for (let f = 0; f < 6; f++) {
      const [dx, dy, dz] = NEIGHBORS[f];
      if (occupied.has(key(v.x + dx, v.y + dy, v.z + dz))) continue;
      const face = FACES[f];
      for (const corner of face.c) {
        b.positions.push(v.x + corner[0], v.y + corner[1], v.z + corner[2]);
        b.normals.push(face.n[0], face.n[1], face.n[2]);
        b.colors.push(r, g, bch);
      }
      b.indices.push(b.base, b.base + 1, b.base + 2, b.base, b.base + 2, b.base + 3);
      b.base += 4;
    }
  }

  const out = [];
  for (const [mid, b] of buckets) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(b.positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.normals, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(b.colors, 3));
    geo.setIndex(b.indices);
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    out.push({ geometry: geo, materialId: mid });
  }
  return out;
}

/**
 * 根据材质 id 造一个 three 材质. materialId=0 走默认顶点色 (Lambert);
 * 否则用 Standard 材质套用 metalness/roughness/alpha/emissive.
 */
export function makeMaterial(materialId, materials) {
  if (!materialId || !materials || !materials[materialId]) {
    return new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  }
  const m = materials[materialId];
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    metalness: m.metalness || 0,
    roughness: m.roughness !== undefined ? m.roughness : 1,
  });
  if (m.alpha !== undefined && m.alpha < 1) {
    mat.transparent = true;
    mat.opacity = m.alpha;
  }
  if (m.emissive) {
    mat.emissive = new THREE.Color(0xffffff);
    mat.emissiveIntensity = m.emissive;
  }
  if (m.ior) mat.ior = m.ior;
  return mat;
}
