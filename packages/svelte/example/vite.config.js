import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

// 示例开发服务器: 通过 alias 直接指向源码, 无需先构建依赖包。
export default defineConfig({
  root: __dirname,
  plugins: [svelte()],
  resolve: {
    alias: {
      '@voxel-tool/core': resolve(__dirname, '../../core/src/index.js'),
      '@voxel-tool/viewer': resolve(__dirname, '../../viewer/src/index.js'),
      '@voxel-tool/svelte': resolve(__dirname, '../src/index.js'),
    },
  },
  server: { port: 5177, open: false },
});
