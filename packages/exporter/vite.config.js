import { defineConfig } from 'vite';
import { resolve } from 'path';

// 库构建: 把导出器打成 ES module (供 Node 与浏览器使用)。
// three / three 子路径 / @voxel-tool/core / @comfyorg/fbx-exporter-three 作为外部依赖不打包进来,
// 由消费方安装 (peer 形式), 这样不会重复打包 three。
// @gltf-transform/* 与 draco3d 用于 Draco 几何压缩后处理, 同样标为 external:
// draco3d 自带 WASM 编码器体积大, 且不打进 dist, 由消费端就近解析 (与 three 策略一致)。
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: [
        'three',
        /^three\//,
        '@voxel-tool/core',
        '@comfyorg/fbx-exporter-three',
        '@gltf-transform/core',
        '@gltf-transform/extensions',
        'draco3d',
      ],
    },
  },
});
