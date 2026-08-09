// preact/src/VoxViewer.jsx —— 体素模型 3D 查看器 (基于 @voxel-tool/viewer)
//
// 薄包装: 挂载时调用框架无关的 createVoxelViewer, 属性变化时 update(), 卸载时 dispose()。
// 渲染原理 (真实 3D + 深度缓冲 + 面剔除 + 正交等距相机 + OrbitControls) 全在 @voxel-tool/viewer。
import { useEffect, useRef, useState } from 'preact/hooks';
import { createVoxelViewer } from '@voxel-tool/viewer';

export function VoxViewer({
  src = null,
  model = null,
  palette = null,
  background = '#16181e',
  width = 480,
  height = 480,
}) {
  const mountRef = useRef(null);
  const viewer = useRef(null);
  const [caption, setCaption] = useState('');

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
  }, []);

  useEffect(() => {
    viewer.current?.update({ src, model, palette });
  }, [src, model, palette]);

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
