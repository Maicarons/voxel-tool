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
    rollupOptions: {
      // 编辑器只做体素编辑/预览, 不调用 Draco 导出; 把 draco 相关依赖排除出浏览器 bundle,
      // 避免 vite 为动态 import('draco3d') 生成永不加载的 106KB 死 chunk, 也避免 node:fs 被
      // externalize 的浏览器兼容警告。需要浏览器端 Draco 导出时另行接入 (CDN/wasm), 而非此默认构建。
      external: ['draco3d', '@gltf-transform/core', '@gltf-transform/extensions'],
    },
  },
  optimizeDeps: {
    exclude: ['draco3d', '@gltf-transform/core', '@gltf-transform/extensions'],
  },
});
