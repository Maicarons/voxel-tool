import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 独立编辑器项目：默认部署在站点根路径，无需 sub-path base。
export default defineConfig({
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
