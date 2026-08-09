import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

// 库构建: 把 Svelte 组件编译为 ES module (供 npm 发布)。
// svelte / three / @voxel-tool/* 作为外部依赖不打包进来 (编译产物依赖 svelte 运行时)。
export default defineConfig({
  plugins: [svelte()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: (id) =>
        /^svelte(\/.*)?$/.test(id) ||
        id === 'three' ||
        id === '@voxel-tool/core' ||
        id === '@voxel-tool/viewer',
    },
  },
});
