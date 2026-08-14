// src/draco.js —— glTF/GLB 的 Draco 几何压缩后处理 (P4.4).
//
// 为什么单独一个模块 + 动态 import:
//   1) three 自带的 GLTFExporter 此版本**不做几何 Draco 压缩**(只压 KTX2 纹理, 而体素是顶点色/无纹理),
//      原生 DRACOExporter 只产独立的 .drc(丢材质/动画/层级) —— 对体素项目不可用。
//      标准做法是用 gltf-transform + draco3d 对导出的 GLB 做 KHR_draco_mesh_compression 后处理，
//      保留 PBR 材质 + 烘焙动画, 体积通常 10×+ 压缩。
//   2) draco3d 自带 WASM 编码器, 体积大, 用动态 import 隔离:
//      不传 draco:true 时完全不会加载, 默认导出路径 (three GLTFExporter) 保持零额外成本。
//   3) 消费端 (CLI/Node/浏览器) 需就近安装 draco3d + @gltf-transform/* (已在 exporter 的
//      dependencies 声明, 且 vite 把三者标为 external 不打包)。
//
// 头 + 入口 API:
//   import { compressGlbDraco } from '@voxel-tool/exporter';
//   const compressed = await compressGlbDraco(glbArrayBuffer, { method:'edgebreaker' });

/**
 * glTF/GLB Draco 压缩选项。
 * @typedef {object} DracoCompressOptions
 * @property {'edgebreaker'|'sequential'} [method='edgebreaker'] 压缩方法: edgebreaker 压缩比更高, sequential 保留顶点序。
 * @property {number} [quantizePosition=14] 位置量化位数 (默认 14 ≈ 0.01mm, 足够体素模型)。
 * @property {number} [quantizeNormal=10]   法线量化位数。
 * @property {number} [quantizeColor=8]     顶点色量化位数。
 * @property {number} [encodeSpeed=5]       编码速度 (越大越快、压缩比略低)。
 * @property {number} [decodeSpeed=5]       解码速度。
 */

/**
 * 把一个 glTF/GLB 的二进制 (ArrayBuffer / Uint8Array) 做 Draco 几何压缩后返回新的 GLB ArrayBuffer。
 *
 * - 输入可以是 GLB (binary) 或 glTF (JSON 字符串 / 对象) —— 自动判断。
 * - 输出**始终**是 GLB (binary), 且含 KHR_draco_mesh_compression 扩展。
 * - 失败 (如未装 draco3d) 会抛出带上下文的错误, 由调用方决定回退到未压缩输出。
 *
 * @param {ArrayBuffer|Uint8Array|string|object} input 原始 glTF/GLB 数据。
 * @param {DracoCompressOptions} [options]
 * @returns {Promise<ArrayBuffer>}
 */
export async function compressGlbDraco(input, options = {}) {
  const {
    method = 'edgebreaker',
    quantizePosition = 14,
    quantizeNormal = 10,
    quantizeColor = 8,
    encodeSpeed = 5,
    decodeSpeed = 5,
  } = options;

  // 动态 import 隔离: 未启用 draco 时不会加载这些重依赖。
  const [{ WebIO }, { KHRDracoMeshCompression }, draco3d] = await Promise.all([
    import('@gltf-transform/core'),
    import('@gltf-transform/extensions'),
    import('draco3d'),
  ]);

  const io = new WebIO().registerExtensions([KHRDracoMeshCompression]);

  // 读取: 支持 GLB(binary) / glTF(JSON 字符串或对象)。
  let document;
  if (input instanceof ArrayBuffer) {
    document = await io.readBinary(new Uint8Array(input));
  } else if (input instanceof Uint8Array) {
    // GLB 以 'glTF' 魔数 (0x46546C67) 开头; 否则当作 JSON 文本。
    const isGlb = input.length >= 4 && input[0] === 0x67 && input[1] === 0x6C && input[2] === 0x54 && input[3] === 0x46;
    if (isGlb) {
      document = await io.readBinary(input);
    } else {
      const text = new TextDecoder().decode(input);
      document = io.read(text);
    }
  } else if (typeof input === 'string') {
    document = io.read(input);
  } else {
    // 对象: 当作 glTF JSON 对象
    document = io.read(JSON.stringify(input));
  }

  // 注册 Draco 编码器 (WASM), 并声明压缩扩展 + 量化选项。
  const encoderModule = await draco3d.createEncoderModule();
  io.registerDependencies({ 'draco3d.encoder': encoderModule });

  document.createExtension(KHRDracoMeshCompression)
    .setRequired(true)
    .setEncoderOptions({
      method: method === 'sequential' ? KHRDracoMeshCompression.EncoderMethod.SEQUENTIAL : KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER,
      encodeSpeed,
      decodeSpeed,
      quantizationBits: {
        POSITION: quantizePosition,
        NORMAL: quantizeNormal,
        COLOR: quantizeColor,
      },
    });

  const out = await io.writeBinary(document);

  // gltf-transform 的 writeBinary 返回 Uint8Array (Node/浏览器一致); 统一成 ArrayBuffer 方便调用方写文件。
  if (out instanceof ArrayBuffer) return out;
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
}
