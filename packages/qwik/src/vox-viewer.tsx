// qwik/src/vox-viewer.tsx —— 体素模型 3D 查看器 (基于 @voxel-tool/viewer)
//
// 薄包装: 在浏览器可见时 (useVisibleTask$) 调用框架无关的 createVoxelViewer, 卸载时 dispose()。
// 由于 Qwik 的可恢复性 (resumability), 这里用 useStore 桥接 props -> 可见任务, 实现数据变化重建。
// 渲染原理 (真实 3D + 深度缓冲 + 面剔除 + 正交等距相机 + OrbitControls) 全在 @voxel-tool/viewer。
import {
  component$,
  useVisibleTask$,
  useSignal,
  useStore,
  useTask$,
} from '@builder.io/qwik';
import { createVoxelViewer } from '@voxel-tool/viewer';

interface VoxViewerProps {
  src?: ArrayBuffer | Uint8Array;
  model?: { size: number[]; voxels: { x: number; y: number; z: number; i: number }[] };
  palette?: number[][];
  background?: string;
  width?: number;
  height?: number;
}

export const VoxViewer = component$<VoxViewerProps>((props) => {
  const containerRef = useSignal<HTMLElement>();
  const viewer = useSignal<ReturnType<typeof createVoxelViewer> | undefined>(undefined);
  const state = useStore<{ src?: any; model?: any; palette?: any }>({
    src: props.src,
    model: props.model,
    palette: props.palette,
  });

  // 把 props 同步进 store, 让可见任务能追踪变化 (Qwik 的响应式模式)
  useTask$(({ track }) => {
    track(() => props.src);
    track(() => props.model);
    track(() => props.palette);
    state.src = props.src;
    state.model = props.model;
    state.palette = props.palette;
  });

  useVisibleTask$(({ track, cleanup }) => {
    track(() => state.src);
    track(() => state.model);
    track(() => state.palette);
    const el = containerRef.value;
    if (!el) return;
    const v = createVoxelViewer(el, {
      src: state.src,
      model: state.model,
      palette: state.palette,
      background: props.background ?? '#16181e',
      width: props.width ?? 480,
      height: props.height ?? 480,
      onInfo: (info) => {
        const cap = info ? `${info[0]} 体素 · ${info[1]} 面` : '';
        const div = el.querySelector('[data-vox-caption]');
        if (div) div.textContent = cap;
      },
    });
    viewer.value = v;
    cleanup(() => {
      v.dispose();
      viewer.value = undefined;
    });
  });

  return (
    <div
      ref={containerRef}
      style={{
        width: `${props.width ?? 480}px`,
        height: `${props.height ?? 480}px`,
        position: 'relative',
        'border-radius': '8px',
        overflow: 'hidden',
        background: props.background ?? '#16181e',
      }}
    >
      <div
        data-vox-caption
        style={{
          position: 'absolute',
          left: '8px',
          bottom: '8px',
          color: '#8b93a7',
          'font-size': '12px',
          'pointer-events': 'none',
        }}
      ></div>
    </div>
  );
});
