import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 编辑器随文档站一起部署在 GitHub Pages 子路径下：
// https://maicarons.github.io/voxel-tool/editor/
export default defineConfig({
  base: '/voxel-tool/editor/',
  plugins: [react()],
  server: {
    port: 5180,
    open: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
