// 常量: 文件魔数与版本
export const MAGIC = [0x56, 0x4f, 0x58, 0x20]; // 'VOX '
export const VERSION = 150;

// 小端写入小工具
export function u32le(view, offset, value) {
  view.setUint32(offset, value, true);
}
