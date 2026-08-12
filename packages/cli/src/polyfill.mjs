// src/polyfill.mjs —— Node 下补齐 three 部分 exporter 需要的浏览器全局。
//   - GLTFExporter 用 FileReader 读取输出 Blob (GLB/DataURL)
//   - PLYExporter 用 requestAnimationFrame 延迟 onDone
// 仅在全局缺失时注入, 对不依赖它们的格式 (obj/stl/fbx) 无副作用。
// 与原仓库 vitest.setup.mjs 的 polyfill 同源, 便于 CLI 独立运行。
import { Buffer } from 'node:buffer';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
}

if (typeof globalThis.FileReader === 'undefined') {
  class FileReaderPolyfill {
    constructor() {
      this.result = null;
      this.onloadend = null;
      this.onerror = null;
    }
    readAsArrayBuffer(blob) {
      this._read(blob, 'arrayBuffer');
    }
    readAsDataURL(blob) {
      this._read(blob, 'dataURL');
    }
    readAsText(blob) {
      this._read(blob, 'text');
    }
    _read(blob, mode) {
      // three 在 readXxx 之后才赋值 onloadend, 这里用微任务延后执行, 确保回调已绑定。
      Promise.resolve()
        .then(async () => {
          if (mode === 'arrayBuffer') {
            this.result = await blob.arrayBuffer();
          } else if (mode === 'text') {
            this.result = await blob.text();
          } else {
            const buf = Buffer.from(await blob.arrayBuffer());
            const mime = blob.type || 'application/octet-stream';
            this.result = `data:${mime};base64,${buf.toString('base64')}`;
          }
        })
        .then(() => {
          if (typeof this.onloadend === 'function') this.onloadend();
        })
        .catch((err) => {
          if (typeof this.onerror === 'function') this.onerror(err);
        });
    }
    abort() {}
  }
  globalThis.FileReader = FileReaderPolyfill;
}
