import { defineConfig } from 'vitepress';

export default defineConfig({
  // GitHub Pages project-site subpath: https://maicarons.github.io/voxel-tool/
  base: '/voxel-tool/',
  title: 'voxel-tool',
  favicon: '/voxel-tool/favicon.ico',
  description:
    'MagicaVoxel .vox read/write and voxel-model 3D viewer — core library + framework-agnostic viewer + React / Vue / Solid / Preact / Svelte / Qwik components',
  locales: {
    root: {
      label: 'English',
      lang: 'en',
      themeConfig: {
        nav: [
          { text: 'Guide', link: '/guide/installation' },
          { text: 'API', link: '/api/core' },
          { text: 'Components', link: '/components/react-viewer' },
          { text: 'Editor', link: '/editor/' },
          { text: 'GitHub', link: 'https://github.com/Maicarons/voxel-tool' },
        ],
        sidebar: [
          {
            text: 'Guide',
            items: [
              { text: 'Installation', link: '/guide/installation' },
              { text: 'Usage', link: '/guide/usage' },
              { text: 'CLI', link: '/guide/cli' },
              { text: 'Publishing to npm', link: '/guide/publishing' },
              { text: 'AI integration', link: '/guide/ai-integration' },
            ],
          },
          {
            text: 'API Reference',
            items: [
              { text: '@voxel-tool/core', link: '/api/core' },
              { text: '@voxel-tool/viewer', link: '/api/viewer' },
              { text: '@voxel-tool/exporter', link: '/api/exporter' },
              { text: '@voxel-tool/react', link: '/api/react' },
              { text: '@voxel-tool/vue', link: '/api/vue' },
              { text: '@voxel-tool/solid', link: '/api/solid' },
              { text: '@voxel-tool/preact', link: '/api/preact' },
              { text: '@voxel-tool/svelte', link: '/api/svelte' },
              { text: '@voxel-tool/qwik', link: '/api/qwik' },
            ],
          },
          {
            text: 'Component Examples',
            items: [
              { text: 'React · VoxViewer', link: '/components/react-viewer' },
              { text: 'Vue · VoxViewer', link: '/components/vue-viewer' },
              { text: 'Solid · VoxViewer', link: '/components/solid-viewer' },
              { text: 'Preact · VoxViewer', link: '/components/preact-viewer' },
              { text: 'Svelte · VoxViewer', link: '/components/svelte-viewer' },
              { text: 'Qwik · VoxViewer', link: '/components/qwik-viewer' },
            ],
          },
          {
            text: 'Try it',
            items: [
              { text: 'Voxel Editor', link: '/editor/' },
            ],
          },
        ],
      },
    },
    zh: {
      label: '简体中文',
      lang: 'zh-CN',
      title: 'voxel-tool',
      description:
        'MagicaVoxel .vox 读写与体素模型 3D 查看器（核心库 + 框架无关查看器 + React / Vue / Solid / Preact / Svelte / Qwik 组件）',
      themeConfig: {
        nav: [
          { text: '指南', link: '/zh/guide/installation' },
          { text: 'API', link: '/zh/api/core' },
          { text: '组件', link: '/zh/components/react-viewer' },
          { text: '编辑器', link: '/editor/' },
          { text: 'GitHub', link: 'https://github.com/Maicarons/voxel-tool' },
        ],
        sidebar: [
          {
            text: '指南',
            items: [
              { text: '安装', link: '/zh/guide/installation' },
              { text: '使用', link: '/zh/guide/usage' },
              { text: '命令行工具', link: '/zh/guide/cli' },
              { text: 'AI 集成', link: '/zh/guide/ai-integration' },
            ],
          },
          {
            text: 'API 参考',
            items: [
              { text: '@voxel-tool/core', link: '/zh/api/core' },
              { text: '@voxel-tool/viewer', link: '/zh/api/viewer' },
              { text: '@voxel-tool/exporter', link: '/zh/api/exporter' },
              { text: '@voxel-tool/react', link: '/zh/api/react' },
              { text: '@voxel-tool/vue', link: '/zh/api/vue' },
              { text: '@voxel-tool/solid', link: '/zh/api/solid' },
              { text: '@voxel-tool/preact', link: '/zh/api/preact' },
              { text: '@voxel-tool/svelte', link: '/zh/api/svelte' },
              { text: '@voxel-tool/qwik', link: '/zh/api/qwik' },
            ],
          },
          {
            text: '组件示例',
            items: [
              { text: 'React · VoxViewer', link: '/zh/components/react-viewer' },
              { text: 'Vue · VoxViewer', link: '/zh/components/vue-viewer' },
              { text: 'Solid · VoxViewer', link: '/zh/components/solid-viewer' },
              { text: 'Preact · VoxViewer', link: '/zh/components/preact-viewer' },
              { text: 'Svelte · VoxViewer', link: '/zh/components/svelte-viewer' },
              { text: 'Qwik · VoxViewer', link: '/zh/components/qwik-viewer' },
            ],
          },
          {
            text: '在线体验',
            items: [
              { text: '体素编辑器', link: '/editor/' },
            ],
          },
        ],
      },
    },
  },
  themeConfig: {
    logo: '/voxel-tool/logo.png',
    socialLinks: [
      { icon: 'github', link: 'https://github.com/Maicarons/voxel-tool' },
    ],
    search: {
      provider: 'local',
    },
    footer: {
      message: 'MIT Licensed © 2026 Maicarons',
    },
  },
});
