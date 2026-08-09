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
// vue/src/VoxViewer.vue —— 体素模型 3D 查看器 (基于 @voxel-tool/viewer)
//
// 薄包装: 挂载时调用框架无关的 createVoxelViewer, 属性变化时 update(), 卸载时 dispose()。
// 渲染原理 (真实 3D + 深度缓冲 + 面剔除 + 正交等距相机 + OrbitControls) 全在 @voxel-tool/viewer。
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { createVoxelViewer } from '@voxel-tool/viewer';

const props = defineProps({
  src: { type: [ArrayBuffer, Uint8Array], default: null },
  model: { type: Object, default: null },
  palette: { type: Array, default: null },
  background: { type: String, default: '#16181e' },
  size: { type: Array, default: () => [480, 480] },
});

const mountRef = ref(null);
const caption = ref('');
let viewer = null;

function onInfo(info) {
  caption.value = info ? `${info[0]} 体素 · ${info[1]} 面` : '';
}

onMounted(() => {
  viewer = createVoxelViewer(mountRef.value, {
    src: props.src,
    model: props.model,
    palette: props.palette,
    background: props.background,
    width: props.size[0],
    height: props.size[1],
    onInfo,
  });
});

onBeforeUnmount(() => {
  viewer?.dispose();
  viewer = null;
});

watch(
  [() => props.src, () => props.model, () => props.palette],
  () => viewer?.update({ src: props.src, model: props.model, palette: props.palette }),
);
watch(
  () => props.background,
  (bg) => viewer?.setBackground(bg),
);
</script>
