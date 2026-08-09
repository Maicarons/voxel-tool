import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import { resolve } from 'path';

// 示例开发服务器: 通过 alias 直接指向源码, 无需先构建依赖包。
export default defineConfig({
  root: __dirname,
  plugins: [solid()],
  resolve: {
    alias: {
      '@voxel-tool/core': resolve(__dirname, '../../core/src/index.js'),
      '@voxel-tool/viewer': resolve(__dirname, '../../viewer/src/index.js'),
      '@voxel-tool/solid': resolve(__dirname, '../src/index.js'),
    },
  },
  server: { port: 5176, open: false },
});
