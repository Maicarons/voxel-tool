import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// 库构建: 把 React 组件打成 ES module (供 npm 发布)。
// react / react-dom / three / @voxel-tool/core 作为外部依赖不打包进来。
export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', 'three', '@voxel-tool/core', '@voxel-tool/viewer'],
    },
  },
});
