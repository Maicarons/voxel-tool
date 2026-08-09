<script setup>
import { ref, computed } from 'vue';
import { VoxViewer } from '@voxel-tool/vue';
import { VoxelGrid, toVoxBytes, parseVox, rainbowPalette } from '@voxel-tool/core';

// 现场用 @vox/base 造模型: 灰底座 + 彩虹球 -> toVoxBytes -> parseVox -> 渲染
function buildSample(seed = 0) {
  const SIZE = 40;
  const grid = new VoxelGrid(SIZE, SIZE, SIZE + 10);
  for (let x = 0; x < SIZE; x++)
    for (let y = 0; y < SIZE; y++) grid.set(x, y, 0, 200); // 索引 200 = 灰

  const cz = 16 + (seed % 5);
  const r = 18;
  grid.addSphere(20, 20, cz, r, (dx, dy, dz) => {
    const frac = Math.max(0, Math.min(1, (dz + r) / (2 * r)));
    return 1 + Math.round(frac * 253);
  });

  const palette = rainbowPalette();
  return parseVox(toVoxBytes(grid, palette));
}

const seed = ref(0);
const info = ref(buildSample(0));
const fileName = ref('内置示例 (灰底座 + 彩虹球)');
const fileInput = ref(null);

const model = computed(() => info.value.models[0]);

function regenerate() {
  seed.value = (seed.value + 1) % 100;
  info.value = buildSample(seed.value);
  fileName.value = `内置示例 #${seed.value}`;
}
async function onFile(e) {
  const f = e.target.files?.[0];
  if (!f) return;
  const buf = new Uint8Array(await f.arrayBuffer());
  try {
    info.value = parseVox(buf);
    fileName.value = f.name;
  } catch (err) {
    alert('解析失败: ' + err.message);
  }
}

const btn = {
  background: '#2b6cff',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  padding: '8px 14px',
  fontSize: '13px',
  cursor: 'pointer',
};
</script>

<template>
  <div style="padding:24px;display:flex;flex-direction:column;gap:16px;align-items:flex-start">
    <h1 style="margin:0;font-size:20px">@voxel-tool/vue · 体素模型查看器</h1>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <button :style="btn" @click="regenerate">重新生成</button>
      <button :style="btn" @click="fileInput?.click()">打开 .vox 文件</button>
      <input ref="fileInput" type="file" accept=".vox" style="display:none" @change="onFile" />
      <span style="color:#8b93a7;font-size:13px">
        {{ fileName }} · {{ model.voxels.length }} 体素 · {{ model.size.join('×') }}
      </span>
    </div>

    <VoxViewer :model="model" :palette="info.palette" />

    <p style="color:#8b93a7;font-size:13px;max-width:520px;line-height:1.6">
      左键拖拽旋转 · 滚轮缩放 · 右键平移。组件基于 Three.js 真实 3D 渲染 (深度缓冲 + 面剔除),
      可传 <code>src</code> (.vox 二进制) 或已解析的 <code>{ model, palette }</code>。
    </p>
  </div>
</template>
