<script>
  // svelte/src/VoxViewer.svelte —— 体素模型 3D 查看器 (基于 @voxel-tool/viewer)
  //
  // 薄包装: 挂载时调用框架无关的 createVoxelViewer, 属性变化时 update(), 卸载时 dispose()。
  // 渲染原理 (真实 3D + 深度缓冲 + 面剔除 + 正交等距相机 + OrbitControls) 全在 @voxel-tool/viewer。
  import { onMount, onDestroy } from 'svelte';
  import { createVoxelViewer } from '@voxel-tool/viewer';

  let { src = null, model = null, palette = null, background = '#16181e', size = [480, 480] } = $props();

  let container;
  let viewer = null;
  let caption = $state('');

  onMount(() => {
    viewer = createVoxelViewer(container, {
      src,
      model,
      palette,
      background,
      width: size[0],
      height: size[1],
      onInfo: (info) => {
        caption = info ? `${info[0]} 体素 · ${info[1]} 面` : '';
      },
    });
  });

  onDestroy(() => {
    viewer?.dispose();
    viewer = null;
  });

  $effect(() => {
    viewer?.update({ src, model, palette });
  });
</script>

<div
  bind:this={container}
  style="width:{size[0]}px;height:{size[1]}px;position:relative;border-radius:8px;overflow:hidden;background:{background};"
>
  {#if caption}
    <div style="position:absolute;left:8px;bottom:8px;color:#8b93a7;font-size:12px;pointer-events:none;">{caption}</div>
  {/if}
</div>
