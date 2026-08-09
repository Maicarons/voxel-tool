import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'voxel-tool',
  description: 'MagicaVoxel .vox 读写与体素模型 3D 查看器（核心库 + React / Vue 组件）',
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
          { text: '@voxel-tool/react', link: '/api/react' },
          { text: '@voxel-tool/vue', link: '/api/vue' },
        ],
      },
      {
        text: '组件示例',
        items: [
          { text: 'React · VoxViewer', link: '/components/react-viewer' },
          { text: 'Vue · VoxViewer', link: '/components/vue-viewer' },
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
