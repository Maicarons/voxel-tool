import { defineConfig } from 'vitest/config';

// 框架组件的单元测试配置: 纯 Node 环境, 不加载框架的 vite 构建插件
// (dist 已由 `npm run build` 预构建, 测试只需验证公开 API 形状, 无需框架编译工具链)。
// 注意: 不能复用本包 vite.config.ts (含 vite-plugin-solid), 它与 Vitest 内置的
// Vite 7 不兼容 (defaultServerConditions is not iterable)。
export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.mjs'],
  },
});
