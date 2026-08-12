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
//
// 动画 (P3): instances 可带 `frames`(逐帧世界变换 [{translation, rotation}]); 查看器提供
//   play()/pause()/stop()/setFrame()/setLoop()/setFrameRate()/isPlaying()/getFrameCount() 播放控制.
//
// 渲染后端: 默认 WebGL (`renderer:'webgl'`); 指定 `renderer:'webgpu'` 会尝试 WebGPURenderer
//   (动态 import three/webgpu), 不可用时自动回退 WebGL, 不影响默认路径.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { parseVox, ROTATION_MATRICES } from '@voxel-tool/core';
import { buildVoxelGeometry, buildVoxelBuckets, buildVoxelGeometryGreedy, buildVoxelBucketsGreedy, makeMaterial } from './mesh.js';

const DEFAULT_BG = '#16181e';

/**
 * 在一个容器元素内挂载体素 3D 查看器.
 * @param {HTMLElement} container
 * @param {object} [options]
 * @param {ArrayBuffer|Uint8Array} [options.src] .vox 二进制 (单模型时用)
 * @param {{size:number[],voxels:object[]}} [options.model] 已解析模型 (单模型时用)
 * @param {Array} [options.instances] 多实例: [{ voxels, translation?, rotation?, hidden?, name?, frames? }]
 *   frames 为逐帧世界变换 [{translation, rotation}], 存在即启用动画播放
 * @param {number[][]} [options.palette] 256 项 [r,g,b,a]
 * @param {object} [options.materials] { id: { type, metalness, roughness, alpha, emissive } }
 * @param {string} [options.background]
 * @param {number} [options.width]
 * @param {number} [options.height]
 * @param {(info: [number, number]|null) => void} [options.onInfo]
 * @param {'webgl'|'webgpu'} [options.renderer] 渲染后端, 默认 webgl
 * @param {number} [options.frameRate] 动画帧率(fps), 默认 12
 * @param {boolean} [options.loop] 动画是否循环, 默认 true
 * @param {(frame: number) => void} [options.onFrame] 每帧切换回调
 */
export function createVoxelViewer(container, options = {}) {
  if (typeof window === 'undefined' || !container) {
    throw new Error('createVoxelViewer 需要浏览器环境与有效的容器元素');
  }
  const opts = {
    background: DEFAULT_BG, width: 480, height: 480, onInfo: null,
    renderer: 'webgl', frameRate: 12, loop: true, onFrame: null, ...options,
  };

  const w = container.clientWidth || opts.width;
  const h = container.clientHeight || opts.height;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(opts.background);

  // 根 group: 统一施加 z-up -> three y-up 的翻转, 使多实例世界变换与全局朝向正确合成.
  const sceneRoot = new THREE.Group();
  sceneRoot.rotation.x = -Math.PI / 2;
  scene.add(sceneRoot);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);

  // 渲染器: 默认 WebGL 同步创建; 若请求 webgpu 则异步创建并热替换 (失败回退 WebGL).
  let renderer;
  let rendererReady = true;
  let controls;

  function makeControls() {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
  }

  function setupWebGL() {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
    container.appendChild(renderer.domElement);
    makeControls();
  }

  if (opts.renderer === 'webgpu') {
    // 先放一个 WebGL 占位以便布局/尺寸就绪, 随后异步尝试 WebGPU 热替换.
    setupWebGL();
    rendererReady = false;
    import('three/webgpu')
      .then(({ WebGPURenderer }) => {
        const r = new WebGPURenderer({ antialias: true });
        return r.init().then(() => {
          r.setPixelRatio(renderer.getPixelRatio());
          const cw = renderer.domElement.clientWidth || w;
          const ch = renderer.domElement.clientHeight || h;
          r.setSize(cw, ch);
          if (renderer.domElement.parentNode === container) {
            container.replaceChild(r.domElement, renderer.domElement);
          }
          controls.dispose();
          renderer.dispose();
          renderer = r;
          makeControls();
          rendererReady = true;
        });
      })
      .catch((e) => {
        console.warn('[voxel-tool] WebGPU 不可用, 回退 WebGL:', e);
        rendererReady = true;
      });
  } else {
    setupWebGL();
  }

  scene.add(new THREE.HemisphereLight(0xffffff, 0x404050, 1.05));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
  keyLight.position.set(1.5, 3, 2.5);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.55);
  fillLight.position.set(-1.5, -2, -2.5);
  scene.add(fillLight);

  let meshes = []; // { mesh, geometry, material }
  let animatedMeshes = []; // { mesh, frames: [{translation, rotation}] }
  let frameCount = 1;
  let currentFrame = 0;
  let playing = false;
  let loop = !!opts.loop;
  let fps = Math.max(1, opts.frameRate || 12);
  let playhead = 0; // 秒
  let lastNow = 0;
  let raf = 0;

  function disposeMeshes() {
    for (const m of meshes) {
      sceneRoot.remove(m.mesh);
      m.geometry.dispose();
      if (Array.isArray(m.material)) m.material.forEach((x) => x.dispose());
      else m.material.dispose();
    }
    meshes = [];
    animatedMeshes = [];
  }

  function worldMatrix(translation, rotation) {
    const t = translation || [0, 0, 0];
    const R = ROTATION_MATRICES[rotation] || ROTATION_MATRICES[0];
    return new THREE.Matrix4().set(
      R[0], R[1], R[2], t[0],
      R[3], R[4], R[5], t[1],
      R[6], R[7], R[8], t[2],
      0, 0, 0, 1,
    );
  }

  function addInstance(voxels, palette, materials, translation, rotation, hidden, frames) {
    if (hidden) return;
    const m4 = worldMatrix(translation, rotation);

    const useMaterials = materials && Object.keys(materials).length > 0;
    const groups = useMaterials
      ? buildVoxelBucketsGreedy(voxels, palette, materials)
      : [{ geometry: buildVoxelGeometryGreedy(voxels, palette), materialId: 0 }];

    for (const g of groups) {
      const mat = makeMaterial(g.materialId, materials);
      const mesh = new THREE.Mesh(g.geometry, mat);
      mesh.matrixAutoUpdate = false;
      mesh.matrix.copy(m4);
      sceneRoot.add(mesh);
      meshes.push({ mesh, geometry: g.geometry, material: mat });
      if (frames && frames.length > 1) animatedMeshes.push({ mesh, frames });
    }
  }

  function applyFrame(f) {
    const fi = ((Math.floor(f) % frameCount) + frameCount) % frameCount;
    currentFrame = fi;
    for (const a of animatedMeshes) {
      const fr = a.frames[Math.min(fi, a.frames.length - 1)];
      a.mesh.matrix.copy(worldMatrix(fr.translation, fr.rotation));
    }
    opts.onFrame?.(fi);
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
        addInstance(inst.voxels, palette, materials, inst.translation, inst.rotation, inst.hidden, inst.frames);
      }
    } else {
      let m = input.model;
      if (!m && input.src) {
        const info = parseVox(input.src);
        m = info.models[0];
        if (palette === undefined) input.palette = info.palette;
      }
      if (!m) { opts.onInfo?.(null); return; }
      addInstance(m.voxels, palette, materials, [0, 0, 0], 0, false, null);
    }

    // 帧数: 取最长动画轨道
    frameCount = 1;
    for (const a of animatedMeshes) frameCount = Math.max(frameCount, a.frames.length);
    currentFrame = 0;
    playing = false;
    playhead = 0;
    applyFrame(0);

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
    if (!rendererReady) return;
    if (playing && frameCount > 1) {
      const now = performance.now();
      const dt = lastNow ? (now - lastNow) / 1000 : 0;
      lastNow = now;
      playhead += dt;
      let f = Math.floor(playhead * fps);
      if (f >= frameCount) {
        if (loop) { f = f % frameCount; playhead = f / fps; }
        else { f = frameCount - 1; playing = false; }
      }
      applyFrame(f);
    }
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
    // —— 动画播放控制 (P3) ——
    play() {
      if (frameCount <= 1) return;
      playing = true;
      lastNow = performance.now();
    },
    pause() {
      playing = false;
    },
    stop() {
      playing = false;
      playhead = 0;
      applyFrame(0);
    },
    setFrame(i) {
      playing = false;
      playhead = Math.max(0, i) / fps;
      applyFrame(i);
    },
    setLoop(b) {
      loop = !!b;
    },
    setFrameRate(rate) {
      fps = Math.max(1, rate || 12);
    },
    isPlaying() {
      return playing;
    },
    getFrameCount() {
      return frameCount;
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
