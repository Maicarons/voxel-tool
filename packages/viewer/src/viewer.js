// viewer/src/viewer.js —— 框架无关的 Three.js 体素查看器控制器
//
// 用法 (任意框架):
//   const v = createVoxelViewer(containerEl, { src, model, instances, palette, materials, onInfo });
//   v.update({ model, instances, palette, materials });
//   v.dispose();
//
// 支持两种数据来源:
//   1) 单模型 (向后兼容): 传 `model`(已解析) 或 `src`(.vox 二进制), 渲染在原点.
//   2) 多实例场景:        传 `instances`(数组, 每个含 voxels + 世界变换 translation/rotation),
//      配合 `parseVox` 返回的 `scene` 使用, 正确还原 MagicaVoxel 的多模型/变换布局.
//   `materials`(来自 parseVox 的 MATL) 会让对应体素用 MeshStandardMaterial 渲染金属/粗糙/透明/自发光.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { parseVox, ROTATION_MATRICES } from '@voxel-tool/core';
import { buildVoxelGeometry, buildVoxelBuckets, makeMaterial } from './mesh.js';

const DEFAULT_BG = '#16181e';

/**
 * 在一个容器元素内挂载体素 3D 查看器.
 * @param {HTMLElement} container
 * @param {object} [options]
 * @param {ArrayBuffer|Uint8Array} [options.src] .vox 二进制 (单模型时用)
 * @param {{size:number[],voxels:object[]}} [options.model] 已解析模型 (单模型时用)
 * @param {Array} [options.instances] 多实例: [{ voxels, translation?, rotation?, hidden?, name? }]
 * @param {number[][]} [options.palette] 256 项 [r,g,b,a]
 * @param {object} [options.materials] { id: { type, metalness, roughness, alpha, emissive } }
 * @param {string} [options.background]
 * @param {number} [options.width]
 * @param {number} [options.height]
 * @param {(info: [number, number]|null) => void} [options.onInfo]
 */
export function createVoxelViewer(container, options = {}) {
  if (typeof window === 'undefined' || !container) {
    throw new Error('createVoxelViewer 需要浏览器环境与有效的容器元素');
  }
  const opts = { background: DEFAULT_BG, width: 480, height: 480, onInfo: null, ...options };

  const w = container.clientWidth || opts.width;
  const h = container.clientHeight || opts.height;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(opts.background);

  // 根 group: 统一施加 z-up -> three y-up 的翻转, 使多实例世界变换与全局朝向正确合成.
  const sceneRoot = new THREE.Group();
  sceneRoot.rotation.x = -Math.PI / 2;
  scene.add(sceneRoot);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h);
  container.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x404050, 1.05));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
  keyLight.position.set(1.5, 3, 2.5);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.55);
  fillLight.position.set(-1.5, -2, -2.5);
  scene.add(fillLight);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  let meshes = []; // { mesh, geometry, material }
  let raf = 0;

  function disposeMeshes() {
    for (const m of meshes) {
      sceneRoot.remove(m.mesh);
      m.geometry.dispose();
      if (Array.isArray(m.material)) m.material.forEach((x) => x.dispose());
      else m.material.dispose();
    }
    meshes = [];
  }

  function addInstance(voxels, palette, materials, translation, rotation, hidden) {
    if (hidden) return;
    const t = translation || [0, 0, 0];
    const R = ROTATION_MATRICES[rotation] || ROTATION_MATRICES[0];
    const m4 = new THREE.Matrix4().set(
      R[0], R[1], R[2], t[0],
      R[3], R[4], R[5], t[1],
      R[6], R[7], R[8], t[2],
      0, 0, 0, 1,
    );

    const useMaterials = materials && Object.keys(materials).length > 0;
    const groups = useMaterials
      ? buildVoxelBuckets(voxels, palette, materials)
      : [{ geometry: buildVoxelGeometry(voxels, palette), materialId: 0 }];

    for (const g of groups) {
      const mat = makeMaterial(g.materialId, materials);
      const mesh = new THREE.Mesh(g.geometry, mat);
      mesh.matrixAutoUpdate = false;
      mesh.matrix.copy(m4);
      sceneRoot.add(mesh);
      meshes.push({ mesh, geometry: g.geometry, material: mat });
    }
  }

  function fitCamera() {
    if (!meshes.length) return;
    const box = new THREE.Box3().setFromObject(sceneRoot);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const dist = maxDim * 2.5;
    camera.position.set(center.x + dist, center.y + dist, center.z + dist);
    camera.lookAt(center);
    controls.target.copy(center);
    const aspect = (renderer.domElement.clientWidth || w) / (renderer.domElement.clientHeight || h);
    const half = (maxDim / 2) * 1.2;
    camera.left = -half * aspect;
    camera.right = half * aspect;
    camera.top = half;
    camera.bottom = -half;
    camera.near = 0.1;
    camera.far = dist * 3 + maxDim;
    camera.updateProjectionMatrix();
    controls.update();
  }

  function rebuild(input) {
    disposeMeshes();
    const palette = input.palette;
    const materials = input.materials;

    if (input.instances && input.instances.length) {
      for (const inst of input.instances) {
        addInstance(inst.voxels, palette, materials, inst.translation, inst.rotation, inst.hidden);
      }
    } else {
      let m = input.model;
      if (!m && input.src) {
        const info = parseVox(input.src);
        m = info.models[0];
        if (palette === undefined) input.palette = info.palette;
      }
      if (!m) { opts.onInfo?.(null); return; }
      addInstance(m.voxels, palette, materials, [0, 0, 0], 0, false);
    }

    fitCamera();
    let voxelCount = 0;
    let faceCount = 0;
    for (const m of meshes) {
      voxelCount += m.geometry.getAttribute('color').count / 4; // 每个面4顶点 -> 体素数近似
      faceCount += m.geometry.index.count / 6;
    }
    opts.onInfo?.([voxelCount, faceCount]);
  }

  if (opts.src || opts.model || opts.instances) {
    rebuild({ src: opts.src, model: opts.model, instances: opts.instances, palette: opts.palette, materials: opts.materials });
  }

  const animate = () => {
    raf = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  };
  animate();

  const ro = new ResizeObserver(() => {
    const cw = container.clientWidth, ch = container.clientHeight;
    if (!cw || !ch) return;
    renderer.setSize(cw, ch);
    fitCamera();
  });
  ro.observe(container);

  return {
    update(input = {}) {
      rebuild({ src: input.src, model: input.model, instances: input.instances, palette: input.palette, materials: input.materials });
    },
    setBackground(color) {
      scene.background = new THREE.Color(color);
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      disposeMeshes();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    },
  };
}
