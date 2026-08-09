// viewer/src/viewer.js —— 框架无关的 Three.js 体素查看器控制器
//
// 这是「原项目 viewer 原理」的落地, 但与具体 UI 框架解耦:
//   - 真实 3D 立方体 + WebGL 深度缓冲 (Z-buffer) 正确遮挡, 告别画家算法排序瑕疵;
//   - OrthographicCamera 摆等距角度 -> MagicaVoxel 经典观感;
//   - HemisphereLight + 主/补 DirectionalLight 按面法线着色;
//   - OrbitControls: 左键拖拽旋转、滚轮缩放、右键平移;
//   - 面剔除几何由 ./mesh.js 的 buildVoxelGeometry 提供。
//
// 用法 (任意框架):
//   const v = createVoxelViewer(containerEl, { src, model, palette, onInfo });
//   v.update({ model, palette });   // 数据变化时
//   v.dispose();                    // 卸载时
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { parseVox } from '@voxel-tool/core';
import { buildVoxelGeometry } from './mesh.js';

const DEFAULT_BG = '#16181e';

/**
 * 在一个容器元素内挂载体素 3D 查看器。
 * @param {HTMLElement} container 目标 DOM 元素
 * @param {object} [options]
 * @param {ArrayBuffer|Uint8Array} [options.src] .vox 二进制 (二选一)
 * @param {{size:number[],voxels:object[]}} [options.model] 已解析模型 (二选一)
 * @param {number[][]} [options.palette] 256 项 [r,g,b,a]
 * @param {string} [options.background] 画布背景色
 * @param {number} [options.width] 初始宽度 (px)
 * @param {number} [options.height] 初始高度 (px)
 * @param {(info: [number, number]|null) => void} [options.onInfo] 重建后回调: [体素数, 面数]
 * @returns {{ update: Function, setBackground: Function, dispose: Function }}
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

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h);
  container.appendChild(renderer.domElement);

  // 光照 (参考 threejs-vox-loader / coding.kiwi)
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

  const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });

  let mesh = null;
  let raf = 0;

  // 把相机摆成等距视角并把模型居中、缩放进可视范围 (正交相机与距离无关, 只调 frustum)
  function fitCamera() {
    if (!mesh) return;
    const box = new THREE.Box3().setFromObject(mesh);
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
    if (mesh) {
      scene.remove(mesh);
      mesh.geometry.dispose();
      mesh = null;
    }
    let m = input.model, pal = input.palette;
    if (!m && input.src) {
      const info = parseVox(input.src);
      m = info.models[0];
      pal = info.palette;
    }
    if (!m) {
      opts.onInfo?.(null);
      return;
    }
    const geo = buildVoxelGeometry(m.voxels, pal);
    mesh = new THREE.Mesh(geo, material);
    scene.add(mesh);
    fitCamera();
    const faceCount = geo.index.count / 6;
    opts.onInfo?.([m.voxels.length, faceCount]);
  }

  // 初始构建
  if (opts.src || opts.model) rebuild({ src: opts.src, model: opts.model, palette: opts.palette });

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
      rebuild({ src: input.src, model: input.model, palette: input.palette });
    },
    setBackground(color) {
      scene.background = new THREE.Color(color);
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      if (mesh) mesh.geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    },
  };
}
