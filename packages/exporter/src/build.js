// src/build.js —— 把体素数据装配成 y-up 的 THREE.Group (导出用的现成对象).
//
// 输入支持三种来源 (与 viewer / core 一致):
//   1) 解析后的 VOX 结果 (core.parseVox 返回): { models, scene, palette, materials }
//   2) 单模型: { model: { size, voxels }, palette, materials }
//   3) 显式多实例: { instances: [{ voxels, translation?, rotation?, hidden?, name? }], palette, materials }
//
// 朝向: 几何体在 voxel 本地空间是 z-up, 根 Group 施加 rotation.x = -π/2 翻成 three 的
// y-up, 与 viewer 完全对齐, 保证 Blender/Unity 里模型「立着」且颜色正确。
import * as THREE from 'three';
import { ROTATION_MATRICES, defaultPalette } from '@voxel-tool/core';
import { buildVoxelGeometry, buildVoxelBuckets, buildVoxelGeometryGreedy, buildVoxelBucketsGreedy, makeMaterial } from './geometry.js';

/**
 * 把各种输入归一化成统一结构:
 *   { palette, materials, instances:[{ voxels, translation, rotation, hidden, name }] }
 * @param {object} input
 */
export function normalizeInput(input) {
  const palette = input && input.palette ? input.palette : defaultPalette();
  const materials = (input && input.materials) || {};

  let instances = [];

  if (input && Array.isArray(input.instances)) {
    // 显式多实例
    instances = input.instances.map((inst) => ({
      voxels: inst.voxels || [],
      translation: inst.translation || [0, 0, 0],
      rotation: inst.rotation || 0,
      hidden: !!inst.hidden,
      name: inst.name || '',
    }));
  } else if (input && Array.isArray(input.models) && Array.isArray(input.scene)) {
    // 解析后的 VOX 结果: 每个 scene 实例引用一个 model
    const models = input.models;
    instances = input.scene.map((s) => ({
      voxels: (models[s.modelIndex] && models[s.modelIndex].voxels) || [],
      translation: s.translation || [0, 0, 0],
      rotation: s.rotation || 0,
      hidden: !!s.hidden,
      name: s.name || '',
    }));
  } else {
    // 单模型 (向后兼容): input.model 或 input.models[0]
    const m = input && (input.model || (Array.isArray(input.models) ? input.models[0] : null));
    if (m) {
      instances = [{ voxels: m.voxels || [], translation: [0, 0, 0], rotation: 0, hidden: false, name: '' }];
    }
  }

  return { palette, materials, instances };
}

/**
 * 构建导出对象: y-up 的 THREE.Group.
 * 每个实例 = 一个/多个 Mesh (按材质分桶), 其世界变换 = R(rotation) * T(translation) (z-up 本地空间),
 * 再被根 Group 的 rotation.x=-π/2 统一翻成 y-up。
 * @param {object} input 见 normalizeInput
 * @returns {THREE.Group}
 */
export function buildExportObject(input) {
  const { palette, materials, instances } = normalizeInput(input);

  const root = new THREE.Group();
  root.name = 'VoxelExport';
  // z-up (voxel 本地) -> three y-up
  root.rotation.x = -Math.PI / 2;

  const hasMaterials = materials && Object.keys(materials).length > 0;

  for (const inst of instances) {
    if (inst.hidden) continue;
    const t = inst.translation;
    const R = ROTATION_MATRICES[inst.rotation] || ROTATION_MATRICES[0];

    // 世界变换矩阵 (z-up 本地空间): world = R * local + t
    const m4 = new THREE.Matrix4().set(
      R[0], R[1], R[2], t[0],
      R[3], R[4], R[5], t[1],
      R[6], R[7], R[8], t[2],
      0, 0, 0, 1,
    );
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scl = new THREE.Vector3();
    m4.decompose(pos, quat, scl);

    const groups = hasMaterials
      ? buildVoxelBucketsGreedy(inst.voxels, palette, materials)
      : [{ geometry: buildVoxelGeometryGreedy(inst.voxels, palette), materialId: 0 }];

    for (const g of groups) {
      const mat = makeMaterial(g.materialId, materials);
      const mesh = new THREE.Mesh(g.geometry, mat);
      mesh.name = inst.name || 'VoxelMesh';
      mesh.position.copy(pos);
      mesh.quaternion.copy(quat);
      mesh.scale.copy(scl);
      root.add(mesh);
    }
  }

  root.updateMatrixWorld(true);
  return root;
}
