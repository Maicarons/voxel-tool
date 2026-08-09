import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'voxel-tool',
  description: 'MagicaVoxel .vox 读写与体素模型 3D 查看器（核心库 + 框架无关查看器 + React / Vue / Solid / Preact / Svelte / Qwik 组件）',
  lang: 'zh-CN',
  themeConfig: {
    nav: [
      { text: '指南', link: '/guide/installation' },
      { text: 'API', link: '/api/core' },
      { text: '组件', link: '/components/react-viewer' },
      { text: 'GitHub', link: 'https://github.com/Maicarons/voxel-tool' },
    ],
    sidebar: [
      {
        text: '指南',
        items: [
          { text: '安装', link: '/guide/installation' },
          { text: '使用', link: '/guide/usage' },
          { text: '发布到 npm', link: '/guide/publishing' },
        ],
      },
      {
        text: 'API 参考',
        items: [
          { text: '@voxel-tool/core', link: '/api/core' },
          { text: '@voxel-tool/viewer', link: '/api/viewer' },
          { text: '@voxel-tool/react', link: '/api/react' },
          { text: '@voxel-tool/vue', link: '/api/vue' },
          { text: '@voxel-tool/solid', link: '/api/solid' },
          { text: '@voxel-tool/preact', link: '/api/preact' },
          { text: '@voxel-tool/svelte', link: '/api/svelte' },
          { text: '@voxel-tool/qwik', link: '/api/qwik' },
        ],
      },
      {
        text: '组件示例',
        items: [
          { text: 'React · VoxViewer', link: '/components/react-viewer' },
          { text: 'Vue · VoxViewer', link: '/components/vue-viewer' },
          { text: 'Solid · VoxViewer', link: '/components/solid-viewer' },
          { text: 'Preact · VoxViewer', link: '/components/preact-viewer' },
          { text: 'Svelte · VoxViewer', link: '/components/svelte-viewer' },
          { text: 'Qwik · VoxViewer', link: '/components/qwik-viewer' },
        ],
      },
    ],
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
