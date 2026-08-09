// react/src/VoxViewer.jsx —— 体素模型 3D 查看器 (基于 @voxel-tool/viewer)
//
// 薄包装: 挂载时调用框架无关的 createVoxelViewer, 属性变化时 update(), 卸载时 dispose()。
// 渲染原理 (真实 3D 立方体 + 深度缓冲 + 面剔除 + 正交等距相机 + OrbitControls) 全部在
// @voxel-tool/viewer 内实现, 这里只负责把 React 生命周期对接上去。
import React, { useEffect, useRef, useState } from 'react';
import { createVoxelViewer } from '@voxel-tool/viewer';

export default function VoxViewer({
  src = null,            // .vox 二进制 (ArrayBuffer / Uint8Array)
  model = null,          // 已解析模型 { size, voxels }
  palette = null,        // 256 项 [r,g,b,a]
  background = '#16181e',
  width = 480,
  height = 480,
}) {
  const mountRef = useRef(null);
  const viewer = useRef(null);
  const [caption, setCaption] = useState('');

  // 初始化 three 场景 (仅一次)
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    viewer.current = createVoxelViewer(mount, {
      src,
      model,
      palette,
      background,
      width,
      height,
      onInfo: (info) => setCaption(info ? `${info[0]} 体素 · ${info[1]} 面` : ''),
    });
    return () => {
      viewer.current?.dispose();
      viewer.current = null;
    };
    // 仅在挂载时初始化一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 模型 / 调色板变化 -> 重建网格
  useEffect(() => {
    viewer.current?.update({ src, model, palette });
  }, [src, model, palette]);

  // 背景色变化
  useEffect(() => {
    viewer.current?.setBackground(background);
  }, [background]);

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
