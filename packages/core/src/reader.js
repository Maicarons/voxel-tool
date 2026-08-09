// VOX 读取器 (纯 JS, 浏览器/Node 通用)
// 返回 { version, models:[{size:[sx,sy,sz], voxels:[{x,y,z,i}]}], palette:[[r,g,b,a]x256]|null }

function ascii4(u8, off) {
  let s = '';
  for (let i = 0; i < 4; i++) s += String.fromCharCode(u8[off + i]);
  return s;
}

export function parseVox(input) {
  const u8 = input instanceof Uint8Array ? input : new Uint8Array(input);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (ascii4(u8, 0) !== 'VOX ') throw new Error('不是合法的 VOX 文件 (magic 不匹配)');
  const version = dv.getUint32(4, true);

  const models = [];
  let palette = null;

  function parseChildren(start, end) {
    let p = start;
    while (p + 12 <= end) {
      const id = ascii4(u8, p);
      const N = dv.getUint32(p + 4, true);
      const M = dv.getUint32(p + 8, true);
      const contentStart = p + 12;
      const contentEnd = contentStart + N;
      const childStart = contentEnd;
      const childEnd = childStart + M;

      if (id === 'MAIN') {
        parseChildren(childStart, childEnd);
      } else if (id === 'SIZE') {
        const sx = dv.getUint32(contentStart, true);
        const sy = dv.getUint32(contentStart + 4, true);
        const sz = dv.getUint32(contentStart + 8, true);
        models.push({ size: [sx, sy, sz], voxels: [] });
      } else if (id === 'XYZI') {
        const n = dv.getUint32(contentStart, true);
        const vox = [];
        let off = contentStart + 4;
        for (let k = 0; k < n; k++) {
          vox.push({ x: u8[off], y: u8[off + 1], z: u8[off + 2], i: u8[off + 3] });
          off += 4;
        }
        if (models.length) models[models.length - 1].voxels = vox;
      } else if (id === 'RGBA') {
        const raw = [];
        for (let k = 0; k < 256; k++) {
          const o = contentStart + k * 4;
          raw.push([u8[o], u8[o + 1], u8[o + 2], u8[o + 3]]);
        }
        // 还原逻辑调色板: 索引 1..255 = stream[0..254]; 索引 0 = stream[255]
        const logical = Array.from({ length: 256 }, () => [0, 0, 0, 0]);
        for (let i = 0; i < 255; i++) logical[i + 1] = raw[i];
        logical[0] = raw[255];
        palette = logical;
      }
      p = childEnd;
    }
  }

  if (ascii4(u8, 8) !== 'MAIN') throw new Error('顶层 chunk 不是 MAIN');
  const N = dv.getUint32(12, true);
  const M = dv.getUint32(16, true);
  parseChildren(20, 20 + M);
  return { version, models, palette };
}
