import { defineConfig } from 'vite';
import { qwikVite } from '@builder.io/qwik/optimizer';
import { resolve } from 'path';

// 示例开发服务器: 通过 alias 直接指向源码, 无需先构建依赖包。
// 注意: Qwik 组件依赖 @builder.io/qwik 优化器, 因此示例也需启用 qwikVite()。
export default defineConfig({
  root: __dirname,
  plugins: [qwikVite()],
  resolve: {
    alias: {
      '@voxel-tool/core': resolve(__dirname, '../../core/src/index.js'),
      '@voxel-tool/viewer': resolve(__dirname, '../../viewer/src/index.js'),
      '@voxel-tool/qwik': resolve(__dirname, '../src/index.js'),
    },
  },
  server: { port: 5178, open: false },
});
