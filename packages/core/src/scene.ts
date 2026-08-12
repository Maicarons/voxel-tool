// 场景图装配: 从 nTRN / nSHP / nGRP 节点图算出每个 shape 的逐帧世界变换.
// 依赖 rotation.js 的 ROTATION_MATRICES 与 3x3 矩阵运算.
import { ROTATION_MATRICES, matMul3, matVec3, rotationIndex } from './rotation.js';

// 从节点图算出每个 shape 的逐帧世界变换, 输出 scene 实例数组.
// 每个实例带 frames[frameCount] = { translation, rotation } (每帧世界变换);
// 静态文件 (frameCount===1) 不附加 frames 键, 保持向后兼容.
export function buildScene(nodes, modelCount, frameCount) {
  const parents = {};
  for (const id in nodes) {
    const n = nodes[id];
    if (n.type === 'group') for (const c of n.children) parents[c] = Number(id);
    else if (n.type === 'transform') parents[n.child] = Number(id);
  }

  const instances = [];
  for (const id in nodes) {
    if (nodes[id].type !== 'shape') continue;
    // path: 从 shape 向上回溯到根, 再反转成 root->leaf
    const path = [];
    let cur = Number(id);
    while (cur !== undefined) { path.push(cur); cur = parents[cur]; }
    path.reverse();

    // hidden / name / hasAnim 与帧无关, 先遍历一次确定
    let hidden = false;
    let name = '';
    let hasAnim = false;
    for (const nid of path) {
      const n = nodes[nid];
      if (!n) continue;
      if (n.type === 'transform') {
        if (n.hidden) hidden = true;
        if (n.name) name = n.name;
        if (n.keyframes && n.keyframes.length) hasAnim = true;
      } else if (n.type === 'shape') {
        if (n.name) name = n.name;
      } else if (n.type === 'group') {
        if (n.name) name = n.name;
      }
    }

    const frames = [];
    for (let f = 0; f < frameCount; f++) {
      let cumR = ROTATION_MATRICES[0]; // identity
      let cumT = [0, 0, 0];
      for (const nid of path) {
        const n = nodes[nid];
        if (!n) continue;
        if (n.type === 'transform') {
          // 取该帧的变换 (无关键帧用静态值; 关键帧越界夹到末帧)
          const kf = n.keyframes && n.keyframes.length
            ? n.keyframes[Math.min(f, n.keyframes.length - 1)]
            : { translation: n.translation, rotation: n.rotation, pivot: [0, 0, 0] };
          const p = kf.pivot || [0, 0, 0];
          const R = ROTATION_MATRICES[kf.rotation] || ROTATION_MATRICES[0];
          // 枢轴合成: 平移增量 tInc = p + R·(-p); 整体平移 = cumT + cumR·(tInc + kf.translation)
          const rp = matVec3(R, [-p[0], -p[1], -p[2]]);
          const tInc = [p[0] + rp[0], p[1] + rp[1], p[2] + rp[2]];
          const tLocal = [
            tInc[0] + (kf.translation[0] || 0),
            tInc[1] + (kf.translation[1] || 0),
            tInc[2] + (kf.translation[2] || 0),
          ];
          cumT = [
            cumT[0] + matVec3(cumR, tLocal)[0],
            cumT[1] + matVec3(cumR, tLocal)[1],
            cumT[2] + matVec3(cumR, tLocal)[2],
          ];
          cumR = matMul3(cumR, R);
        } else if (n.type === 'shape') {
          const off = n.offset || [0, 0, 0];
          cumT = [
            cumT[0] + matVec3(cumR, off)[0],
            cumT[1] + matVec3(cumR, off)[1],
            cumT[2] + matVec3(cumR, off)[2],
          ];
        }
      }
      frames.push({
        translation: cumT.map((v) => Math.round(v)),
        rotation: rotationIndex(cumR),
      });
    }

    instances.push({
      modelIndex: nodes[id].modelId,
      translation: frames[0].translation,
      rotation: frames[0].rotation,
      hidden,
      name,
      // 仅当路径上真的有关键帧节点才附加 frames, 保持静态文件(及动画里的静态对象)无损
      frames: hasAnim ? frames : undefined,
    });
  }

  // 老文件(没有场景图): 每个模型给一个 identity 实例
  if (instances.length === 0) {
    const count = modelCount || 0;
    for (let i = 0; i < count; i++) {
      instances.push({ modelIndex: i, translation: [0, 0, 0], rotation: 0, hidden: false, name: '' });
    }
  }
  return instances;
}
