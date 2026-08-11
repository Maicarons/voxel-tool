// packages/exporter/vitest.config.js
// 注意: 本包同时有 vite.config.js (库构建用)。Vitest 优先使用本文件而非 vite.config.js,
// 因此必须把测试环境 + setupFiles 写在这里, 否则 `npm test -w` 会误用构建配置而丢失 setup。
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    // 补齐 three 部分 exporter 需要的浏览器全局 (FileReader / requestAnimationFrame)。
    // 指向仓库根目录的共享 setup 文件 (绝对路径, 避免 cwd 不同的解析问题)。
    setupFiles: [fileURLToPath(new URL('../../vitest.setup.mjs', import.meta.url))],
    reporters: process.env.CI ? ['dot'] : ['default'],
  },
});
