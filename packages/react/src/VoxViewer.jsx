// react/src/VoxViewer.jsx —— 体素模型 3D 查看器 (基于 Three.js)
//
// 这是「原项目 viewer 原理」的落地:
//   - 真实 3D 立方体 + WebGL 深度缓冲 (Z-buffer) 正确遮挡, 告别画家算法排序瑕疵;
//   - OrthographicCamera 摆等距角度 -> MagicaVoxel 经典观感;
//   - HemisphereLight + 主/补 DirectionalLight 按面法线着色;
//   - OrbitControls: 左键拖拽旋转、滚轮缩放、右键平移。
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { parseVox } from '@voxel-tool/core';
import { buildVoxelGeometry } from './mesh.js';

export default function VoxViewer({
  src = null,            // .vox 二进制 (ArrayBuffer / Uint8Array)
  model = null,          // 已解析模型 { size, voxels }
  palette = null,        // 256 项 [r,g,b,a]
  background = '#16181e',
  width = 480,
  height = 480,
}) {
  const mountRef = useRef(null);
  const three = useRef(null);
  const [caption, setCaption] = useState('');

  // 初始化 three 场景 (仅一次)
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const w = mount.clientWidth || width;
    const h = mount.clientHeight || height;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(background);

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
    mount.appendChild(renderer.domElement);

    // 光照 (参考 threejs-vox-loader / coding.kiwi)
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

    three.current = { scene, camera, renderer, controls, material, mesh: null, raf: 0 };

    const animate = () => {
      three.current.raf = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const ro = new ResizeObserver(() => {
      const cw = mount.clientWidth, ch = mount.clientHeight;
      if (!cw || !ch) return;
      renderer.setSize(cw, ch);
      if (three.current?.mesh) fitCamera(three.current, cw, ch);
    });
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(three.current.raf);
      ro.disconnect();
      controls.dispose();
      if (three.current.mesh) three.current.mesh.geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      three.current = null;
    };
    // 仅在挂载时初始化一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 模型变化 -> 重建网格并取景
  useEffect(() => {
    const t = three.current;
    if (!t) return;
    if (t.mesh) {
      t.scene.remove(t.mesh);
      t.mesh.geometry.dispose();
      t.mesh = null;
    }
    let m = model, pal = palette;
    if (!m && src) {
      const info = parseVox(src);
      m = info.models[0];
      pal = info.palette;
    }
    if (!m) return;
    const geo = buildVoxelGeometry(m.voxels, pal);
    t.mesh = new THREE.Mesh(geo, t.material);
    t.scene.add(t.mesh);
    fitCamera(t, mountRef.current.clientWidth || width, mountRef.current.clientHeight || height);
    setCaption(`${m.voxels.length} 体素 · ${geo.index.count / 6} 面`);
  }, [model, src, palette]);

  return (
    <div
      ref={mountRef}
      style={{ width, height, position: 'relative', borderRadius: 8, overflow: 'hidden', background }}
    >
      {caption && (
        <div style={{ position: 'absolute', left: 8, bottom: 8, color: '#8b93a7', fontSize: 12, pointerEvents: 'none' }}>
          {caption}
        </div>
      )}
    </div>
  );
}

// 把相机摆成等距视角并把模型居中、缩放进可视范围 (正交相机与距离无关, 只调 frustum)
function fitCamera(t, w, h) {
  const obj = t.mesh;
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const dist = maxDim * 2.5;
  t.camera.position.set(center.x + dist, center.y + dist, center.z + dist);
  t.camera.lookAt(center);
  t.controls.target.copy(center);
  const aspect = (w || 1) / (h || 1);
  const half = (maxDim / 2) * 1.2;
  t.camera.left = -half * aspect;
  t.camera.right = half * aspect;
  t.camera.top = half;
  t.camera.bottom = -half;
  t.camera.near = 0.1;
  t.camera.far = dist * 3 + maxDim;
  t.camera.updateProjectionMatrix();
  t.controls.update();
}
