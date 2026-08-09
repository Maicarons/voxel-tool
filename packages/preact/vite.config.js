import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { resolve } from 'path';

// 库构建: 把 Preact 组件打成 ES module (供 npm 发布)。
// preact / preact/hooks / three / @voxel-tool/* 作为外部依赖不打包进来。
export default defineConfig({
  plugins: [preact()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: ['preact', 'preact/hooks', 'three', '@voxel-tool/core', '@voxel-tool/viewer'],
    },
  },
});
