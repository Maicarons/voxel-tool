import { defineConfig } from 'vite';
import { resolve } from 'path';

// 库构建: 用 esbuild 的 Qwik JSX runtime 把组件编译为 ES module (供 npm 发布)。
//
// 注意: 这里**不走 qwikVite 优化器** —— 那是给 Qwik *应用* 用的, 它会强制要求 src/root 应用入口,
// 不适合库构建。我们用 esbuild 的 jsxImportSource 指向 @builder.io/qwik/jsx-runtime 完成 JSX 编译,
// 把 @builder.io/qwik / three / @voxel-tool/* 全部外部化。
//
// 消费端项目需在自身 qwikVite 配置里把本包加入 vendorRoots, 优化器才会一并处理导出的 QRL:
//   qwikVite({ vendorRoots: [ '@voxel-tool/qwik' ] })
export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: '@builder.io/qwik',
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: ['@builder.io/qwik', 'three', '@voxel-tool/core', '@voxel-tool/viewer'],
    },
  },
});
