import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// 全局 Vitest 配置: 纯 Node 环境即可 (几何/解析逻辑不需要浏览器/WebGL).
// 不指定 include —— Vitest 默认按 cwd 相对收集 **/*.test.*, 因此各包
// `npm test`(cwd=该包) 只会跑自己包内的测试, 不会重复执行其他包.
export default defineConfig({
  test: {
    environment: 'node',
    // 补齐 three 部分 exporter 需要的浏览器全局 (FileReader / requestAnimationFrame).
    // 用绝对路径, 避免各包运行时 root 不同导致找不到 setup 文件。
    setupFiles: [fileURLToPath(new URL('./vitest.setup.mjs', import.meta.url))],
    reporters: process.env.CI ? ['dot'] : ['default'],
  },
});
