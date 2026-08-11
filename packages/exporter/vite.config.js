import { defineConfig } from 'vite';
import { resolve } from 'path';

// 库构建: 把导出器打成 ES module (供 Node 与浏览器使用)。
// three / three 子路径 / @voxel-tool/core / @comfyorg/fbx-exporter-three 作为外部依赖不打包进来,
// 由消费方安装 (peer 形式), 这样不会重复打包 three。
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
        /^three\//,
        '@voxel-tool/core',
        '@comfyorg/fbx-exporter-three',
      ],
    },
  },
});
