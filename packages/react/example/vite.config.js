import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// 示例开发服务器: 通过 alias 直接指向源码, 无需先 npm install 依赖包。
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: {
    alias: {
      '@voxel-tool/core': resolve(__dirname, '../../core/src/index.js'),
      '@voxel-tool/react': resolve(__dirname, '../src/index.js'),
    },
  },
  server: { port: 5173, open: false },
});
