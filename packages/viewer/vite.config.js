import { defineConfig } from 'vite';
import { resolve } from 'path';

// 库构建: 把框架无关的查看器核心打成 ES module (供各组件包依赖)。
// three / @voxel-tool/core / OrbitControls 作为外部依赖不打包进来。
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: [
        'three',
        'three/addons/controls/OrbitControls.js',
        '@voxel-tool/core',
      ],
    },
  },
});
