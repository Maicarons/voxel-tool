import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

// 库构建: 把 Vue 组件打成 ES module (供 npm 发布)。
// vue / @voxel-tool/core / three 作为外部依赖不打包进来。
export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: ['vue', '@voxel-tool/core', 'three', '@voxel-tool/viewer'],
    },
  },
});
