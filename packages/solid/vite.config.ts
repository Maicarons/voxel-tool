import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import { resolve } from 'path';

// 库构建: 把 Solid 组件编译为 ES module (供 npm 发布)。
// solid-js / three / @voxel-tool/* 作为外部依赖不打包进来。
export default defineConfig({
  plugins: [solid()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: ['solid-js', 'solid-js/web', 'three', '@voxel-tool/core', '@voxel-tool/viewer'],
    },
  },
});
