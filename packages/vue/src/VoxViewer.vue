<template>
  <div
    ref="mountRef"
    :style="{ width: size[0] + 'px', height: size[1] + 'px', position: 'relative', borderRadius: '8px', overflow: 'hidden' }"
  >
    <div
      v-if="caption"
      :style="{ position: 'absolute', left: '8px', bottom: '8px', color: '#8b93a7', fontSize: '12px', pointerEvents: 'none' }"
    >{{ caption }}</div>
  </div>
</template>

<script setup>
// vue/src/VoxViewer.vue —— 体素模型 3D 查看器 (基于 Three.js)
//
// 与 @vox/react 同原理: 真实 3D 立方体 + 深度缓冲 + 面剔除 + 正交等距相机 +
// 主/补 DirectionalLight + HemisphereLight + OrbitControls (左键旋转/滚轮缩放/右键平移)。
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { parseVox } from '@voxel-tool/core';
import { buildVoxelGeometry } from './mesh.js';

const props = defineProps({
  src: { type: [ArrayBuffer, Uint8Array], default: null },
  model: { type: Object, default: null },
  palette: { type: Array, default: null },
  background: { type: String, default: '#16181e' },
  size: { type: Array, default: () => [480, 480] },
});

const mountRef = ref(null);
const caption = ref('');
let ctx = null;

function fitCamera(obj) {
  const { camera, controls, renderer } = ctx;
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const dist = maxDim * 2.5;
  camera.position.set(center.x + dist, center.y + dist, center.z + dist);
  camera.lookAt(center);
  controls.target.copy(center);
  const aspect = (renderer.domElement.clientWidth || props.size[0]) / (renderer.domElement.clientHeight || props.size[1]);
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

function rebuild() {
  if (!ctx) return;
  const { scene, material } = ctx;
  if (ctx.mesh) {
    scene.remove(ctx.mesh);
    ctx.mesh.geometry.dispose();
    ctx.mesh = null;
  }
  let m = props.model, pal = props.palette;
  if (!m && props.src) {
    const info = parseVox(props.src);
    m = info.models[0];
    pal = info.palette;
  }
  if (!m) return;
  const geo = buildVoxelGeometry(m.voxels, pal);
  ctx.mesh = new THREE.Mesh(geo, material);
  scene.add(ctx.mesh);
  fitCamera(ctx.mesh);
  caption.value = `${m.voxels.length} 体素 · ${geo.index.count / 6} 面`;
}

function init() {
  const mount = mountRef.value;
  if (!mount) return;
  const w = props.size[0];
  const h = props.size[1];

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(props.background);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h);
  mount.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x404050, 1.05));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(1.5, 3, 2.5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.55);
  fill.position.set(-1.5, -2, -2.5);
  scene.add(fill);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });

  ctx = { scene, camera, renderer, controls, material, mesh: null, raf: 0, mount };
  rebuild();

  const animate = () => {
    ctx.raf = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  };
  animate();

  const ro = new ResizeObserver(() => {
    const cw = mount.clientWidth, ch = mount.clientHeight;
    if (!cw || !ch) return;
    renderer.setSize(cw, ch);
    if (ctx?.mesh) fitCamera(ctx.mesh);
  });
  ro.observe(mount);
  ctx.ro = ro;
}

function dispose() {
  if (!ctx) return;
  cancelAnimationFrame(ctx.raf);
  ctx.ro?.disconnect();
  ctx.controls.dispose();
  if (ctx.mesh) ctx.mesh.geometry.dispose();
  ctx.material.dispose();
  ctx.renderer.dispose();
  if (ctx.renderer.domElement.parentNode === ctx.mount) ctx.mount.removeChild(ctx.renderer.domElement);
  ctx = null;
}

onMounted(init);
onBeforeUnmount(dispose);
watch(
  [() => props.src, () => props.model, () => props.palette, () => props.background],
  () => rebuild(),
);
</script>

