import { defineConfig } from 'vite';
import { resolve } from 'path';

// 库构建: 把共享的体素网格算法打成 ES module (被 viewer 与 exporter 依赖)。
// three 作为外部依赖不打包进来, 由消费方安装, 避免重复打包 three。
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: ['three'],
    },
  },
});
