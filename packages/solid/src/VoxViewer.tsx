// solid/src/VoxViewer.tsx —— 体素模型 3D 查看器 (基于 @voxel-tool/viewer)
//
// 薄包装: 挂载时调用框架无关的 createVoxelViewer, 属性变化时 update(), 卸载时 dispose()。
// 渲染原理 (真实 3D + 深度缓冲 + 面剔除 + 正交等距相机 + OrbitControls) 全在 @voxel-tool/viewer。
import { onMount, onCleanup, createEffect, createSignal } from 'solid-js';
import { createVoxelViewer } from '@voxel-tool/viewer';

export function VoxViewer(props: any) {
  let container: HTMLDivElement | undefined;
  let viewer: ReturnType<typeof createVoxelViewer> | undefined;
  const [caption, setCaption] = createSignal('');

  onMount(() => {
    if (!container) return;
    viewer = createVoxelViewer(container, {
      src: props.src,
      model: props.model,
      palette: props.palette,
      background: props.background ?? '#16181e',
      width: props.width ?? 480,
      height: props.height ?? 480,
      onInfo: (info: [number, number] | null) =>
        setCaption(info ? `${info[0]} 体素 · ${info[1]} 面` : ''),
    });
    onCleanup(() => {
      viewer?.dispose();
      viewer = undefined;
    });
  });

  // 数据变化时重建网格
  createEffect(() => {
    viewer?.update({ src: props.src, model: props.model, palette: props.palette });
  });

  return (
    <div
      ref={container}
      style={{
        width: `${props.width ?? 480}px`,
        height: `${props.height ?? 480}px`,
        position: 'relative',
        'border-radius': '8px',
        overflow: 'hidden',
        background: props.background ?? '#16181e',
      }}
    >
      {caption() && (
        <div
          style={{
            position: 'absolute',
            left: '8px',
            bottom: '8px',
            color: '#8b93a7',
            'font-size': '12px',
            'pointer-events': 'none',
          }}
        >
          {caption()}
        </div>
      )}
    </div>
  );
}
