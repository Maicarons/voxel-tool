import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { resolve } from 'path';

// 示例开发服务器: 通过 alias 直接指向源码, 无需先 npm install 依赖包。
export default defineConfig({
  root: __dirname,
  plugins: [preact()],
  resolve: {
    alias: {
      '@voxel-tool/core': resolve(__dirname, '../../core/src/index.js'),
      '@voxel-tool/viewer': resolve(__dirname, '../../viewer/src/index.js'),
      '@voxel-tool/preact': resolve(__dirname, '../src/index.js'),
    },
  },
  server: { port: 5175, open: false },
});
