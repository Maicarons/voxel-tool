// src/geometry.js —— 体素 -> THREE 几何体 (面剔除 + 顶点色 + 按材质分桶)
//
// 与 viewer/mesh.js 同源算法 (face culling + merged BufferGeometry + vertex colors),
// 但做了 **sRGB -> linear** 顶点色修正 (见 plan-export.md §4): 调色板是 sRGB 显示值,
// 而 three 顶点色默认按 linear 解读, 不修正会偏亮。这里在写 color 属性前转换,
// 保证导出文件与屏幕渲染 WYSIWYG。
//
// 几何体处于 voxel 本地空间 (z-up); 整体 z-up -> three y-up 的翻转由 build.js 的
// 根 Group 统一施加, 与 viewer 完全一致。
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

// 复用一个 Color 实例做 sRGB -> linear 转换, 避免每顶点 new。
const _color = new THREE.Color();
function pushLinearColor(colors, col) {
  // col = [r,g,b,a] 0..255 (sRGB)
  _color.setRGB(col[0] / 255, col[1] / 255, col[2] / 255, THREE.SRGBColorSpace);
  colors.push(_color.r, _color.g, _color.b);
}

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
    for (let f = 0; f < 6; f++) {
      const [dx, dy, dz] = NEIGHBORS[f];
      if (occupied.has(key(v.x + dx, v.y + dy, v.z + dz))) continue; // 被遮挡, 剔除
      const face = FACES[f];
      for (const corner of face.c) {
        positions.push(v.x + corner[0], v.y + corner[1], v.z + corner[2]);
        normals.push(face.n[0], face.n[1], face.n[2]);
        pushLinearColor(colors, col);
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
    for (let f = 0; f < 6; f++) {
      const [dx, dy, dz] = NEIGHBORS[f];
      if (occupied.has(key(v.x + dx, v.y + dy, v.z + dz))) continue;
      const face = FACES[f];
      for (const corner of face.c) {
        b.positions.push(v.x + corner[0], v.y + corner[1], v.z + corner[2]);
        b.normals.push(face.n[0], face.n[1], face.n[2]);
        pushLinearColor(b.colors, col);
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
    // 默认材质走 MeshStandardMaterial (顶点色), 对 GLTF/USDZ/FBX 保真度优于 Lambert。
    // 体素是实心立方体, 用 FrontSide 即可 (且 USDZ 不支持双面材质, 避免告警)。
    return new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.FrontSide, metalness: 0, roughness: 1 });
  }
  const m = materials[materialId];
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    side: THREE.FrontSide,
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

// ===========================================================================
// Greedy meshing (P3.2)
// 与 viewer/src/mesh.js 同源算法；颜色走 pushLinearColor (sRGB->linear), 与朴素版一致。
// 把共面、同色、相邻的暴露面合并成最大矩形, 大幅减少大场景三角形数量。
// ===========================================================================

const AXIS_U = [1, 2, 0]; // 对每个轴 dim，定义另外两个轴的排列 (u, v)
const AXIS_V = [2, 0, 1];

function computeVoxelBounds(voxels) {
  let xMin = Infinity, yMin = Infinity, zMin = Infinity;
  let xMax = -Infinity, yMax = -Infinity, zMax = -Infinity;
  for (const v of voxels) {
    if (v.x < xMin) xMin = v.x; if (v.x > xMax) xMax = v.x;
    if (v.y < yMin) yMin = v.y; if (v.y > yMax) yMax = v.y;
    if (v.z < zMin) zMin = v.z; if (v.z > zMax) zMax = v.z;
  }
  return { min: [xMin, yMin, zMin], dims: [xMax - xMin + 1, yMax - yMin + 1, zMax - zMin + 1] };
}

function buildVoxelGrid(voxels, palette) {
  const { min, dims } = computeVoxelBounds(voxels);
  const [xMin, yMin, zMin] = min;
  const present = new Set();  // 所有体素(含透明)
  const colorOf = new Map();  // 可见体素(grid key) -> palette index i
  for (const v of voxels) {
    const k = (v.x - xMin) + ',' + (v.y - yMin) + ',' + (v.z - zMin);
    present.add(k);
    const col = palette ? palette[v.i] : null;
    if (col && col[3] !== 0) colorOf.set(k, v.i);
  }
  return { present, colorOf, min, dims };
}

const gkey = (a, b, c) => a + ',' + b + ',' + c;

// 生成 greedy quad 列表。每个 quad: { f 面索引, w 切片, u, v 网格下界, du, dv 尺寸, i 颜色 }
function emitGreedyQuads(voxels, palette) {
  if (!voxels.length) return { quads: [], min: [0, 0, 0] };
  const { present, colorOf, min, dims } = buildVoxelGrid(voxels, palette);
  const quads = [];
  for (let dim = 0; dim < 3; dim++) {
    const u = AXIS_U[dim], v = AXIS_V[dim];
    const sizeU = dims[u], sizeV = dims[v], sizeW = dims[dim];
    for (let sign = 1; sign >= -1; sign -= 2) {
      const f = dim * 2 + (sign > 0 ? 0 : 1);
      for (let w = 0; w < sizeW; w++) {
        const mask = new Int32Array(sizeU * sizeV).fill(-1);
        for (let gu = 0; gu < sizeU; gu++) {
          for (let gv = 0; gv < sizeV; gv++) {
            const cx = [0, 0, 0];
            cx[dim] = w; cx[u] = gu; cx[v] = gv;
            const k = gkey(cx[0], cx[1], cx[2]);
            const i = colorOf.get(k);
            if (i === undefined) continue; // 体素透明/不存在 -> 无面
            const nx = [cx[0], cx[1], cx[2]];
            nx[dim] = w + sign;
            if (present.has(gkey(nx[0], nx[1], nx[2]))) continue; // 邻居存在(含透明) -> 遮挡
            mask[gu * sizeV + gv] = i;
          }
        }
        const used = new Uint8Array(sizeU * sizeV);
        for (let gv = 0; gv < sizeV; gv++) {
          for (let gu = 0; gu < sizeU; gu++) {
            const idx = gu * sizeV + gv;
            if (mask[idx] < 0 || used[idx]) continue;
            const color = mask[idx];
            let du = 1;
            while (gu + du < sizeU && mask[(gu + du) * sizeV + gv] === color && !used[(gu + du) * sizeV + gv]) du++;
            let dv = 1;
            grow: while (gv + dv < sizeV) {
              for (let i = 0; i < du; i++) {
                const ci = (gu + i) * sizeV + (gv + dv);
                if (mask[ci] !== color || used[ci]) break grow;
              }
              dv++;
            }
            for (let j = 0; j < dv; j++) for (let i = 0; i < du; i++) used[(gu + i) * sizeV + (gv + j)] = 1;
            quads.push({ f, w, u: gu, v: gv, du, dv, i: color });
          }
        }
      }
    }
  }
  return { quads, min };
}

function newArrays() {
  return { positions: [], normals: [], colors: [], indices: [] };
}

function appendGreedyQuad(arrays, q, min, palette, pushColor) {
  const f = q.f;
  const dim = Math.floor(f / 2);
  const u = AXIS_U[dim], v = AXIS_V[dim];
  const n = FACES[f].n;
  const col = palette ? palette[q.i] : null;
  for (const corner of FACES[f].c) {
    const gd = q.w + corner[dim];
    const gu = q.u + (corner[u] > 0 ? q.du : 0) - 0.5;
    const gv = q.v + (corner[v] > 0 ? q.dv : 0) - 0.5;
    const coords = [0, 0, 0];
    coords[dim] = gd; coords[u] = gu; coords[v] = gv;
    arrays.positions.push(coords[0] + min[0], coords[1] + min[1], coords[2] + min[2]);
    arrays.normals.push(n[0], n[1], n[2]);
    pushColor(arrays.colors, col);
  }
  const base = arrays.positions.length / 3 - 4;
  arrays.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function arraysToGeometry(arrays) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(arrays.positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(arrays.normals, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(arrays.colors, 3));
  geo.setIndex(arrays.indices);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

export function buildVoxelGeometryGreedy(voxels, palette) {
  const { quads, min } = emitGreedyQuads(voxels, palette);
  const arrays = newArrays();
  for (const q of quads) appendGreedyQuad(arrays, q, min, palette, pushLinearColor);
  return arraysToGeometry(arrays);
}

export function buildVoxelBucketsGreedy(voxels, palette, materials) {
  const { quads, min } = emitGreedyQuads(voxels, palette);
  const hasMaterials = materials && Object.keys(materials).length > 0;
  const buckets = new Map();
  const getBucket = (mid) => {
    if (!buckets.has(mid)) buckets.set(mid, newArrays());
    return buckets.get(mid);
  };
  for (const q of quads) {
    const mid = hasMaterials && materials[q.i] ? q.i : 0;
    appendGreedyQuad(getBucket(mid), q, min, palette, pushLinearColor);
  }
  const out = [];
  for (const [mid, b] of buckets) out.push({ geometry: arraysToGeometry(b), materialId: mid });
  return out;
}
