// src/tsl.js —— @voxel-tool/mesh
//
// TSL (Three Shading Language) 体素渲染增强: 描边 (fresnel 边缘辉光) + 自发光。
// 设计要点:
//   - 仅作用于 NodeMaterial (WebGPURenderer, 或 WebGL 下的 node 材质路径); 这类材质才能挂
//     emissiveNode 等 TSL 节点。经典 MeshStandardMaterial (WebGL 回退路径) 不支持节点, 此时
//     本函数降级: 仅把自发光套到经典 .emissive/.emissiveIntensity, 描边忽略并返回 false。
//   - three/tsl 是独立于 three/webgpu 的纯节点定义构建 (已验证可在 Node 中静态导入),
//     因此本文件被 exporter/CLI 等 Node 环境引用时不会误拉 WebGPU 渲染器代码。
import * as THREE from 'three';
import {
  positionViewDirection,
  normalView,
  dot,
  abs,
  pow,
  float,
  vec3,
} from 'three/tsl';

/**
 * 把描边 / 自发光 TSL 节点挂到材质上。
 * @param {object} material 目标材质; 必须为 NodeMaterial (isNodeMaterial === true) 才能应用 TSL。
 * @param {object} [opts]
 *   outline?: boolean            是否启用 fresnel 边缘描边 (边缘辉光, 近似描边)
 *   outlineColor?: [r,g,b]       0..1 归一化 RGB (默认黑边 [0,0,0])
 *   outlinePower?: number        fresnel 指数 (默认 3, 越大边缘越锐)
 *   outlineStrength?: number     描边强度 (默认 1)
 *   emissive?: [r,g,b]           0..1 自发光颜色 (默认不启用)
 *   emissiveIntensity?: number   自发光强度 (默认 1)
 * @returns {boolean} true=已应用 TSL 节点 (node 路径); false=经典降级或未应用任何节点
 */
export function applyVoxelTsl(material, opts = {}) {
  if (!material || !material.isNodeMaterial) {
    // 经典材质降级: 仅自发光可映射到 .emissive/.emissiveIntensity
    if (opts.emissive && Array.isArray(opts.emissive)) {
      material.emissive = new THREE.Color(opts.emissive[0], opts.emissive[1], opts.emissive[2]);
      material.emissiveIntensity = opts.emissiveIntensity ?? 1;
    }
    return false;
  }

  const nodes = [];

  if (opts.emissive && Array.isArray(opts.emissive)) {
    nodes.push(
      vec3(opts.emissive[0], opts.emissive[1], opts.emissive[2]).mul(opts.emissiveIntensity ?? 1),
    );
  }

  if (opts.outline) {
    const base = opts.outlineColor && Array.isArray(opts.outlineColor) ? opts.outlineColor : [0, 0, 0];
    // fresnel: 视线与法线越垂直 (轮廓边缘) 值越大
    const fres = pow(
      float(1).sub(abs(dot(normalView, positionViewDirection))),
      float(opts.outlinePower ?? 3),
    );
    nodes.push(vec3(base[0], base[1], base[2]).mul(fres.mul(opts.outlineStrength ?? 1)));
  }

  if (nodes.length) {
    let node = nodes[0];
    for (let i = 1; i < nodes.length; i++) node = node.add(nodes[i]);
    material.emissiveNode = node;
  }
  return true;
}
