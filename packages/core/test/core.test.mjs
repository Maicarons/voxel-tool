// @voxel-tool/core 的 Vitest 回归测试.
// 重点守护 0.2.0 的新能力: .vox 场景图(nTRN/nGRP/nSHP) + MATL 材质无损往返.
import { describe, test, expect } from 'vitest';
import {
  VoxelGrid,
  toVoxBytes,
  toVoxBytesScene,
  parseVox,
  ROTATION_MATRICES,
  rainbowPalette,
  defaultPalette,
  mirrorCoordinates,
  voxelizeMesh,
  voxelCSG,
  gridFromMap,
  CSG_OP,
} from '../src/index.js';

function makePalette() {
  const p = Array.from({ length: 256 }, () => [0, 0, 0, 0]);
  for (let i = 1; i < 256; i++) p[i] = [(i * 7) & 255, (i * 13) & 255, (i * 29) & 255, 255];
  return p;
}

function buildModel(seed, n) {
  const voxels = [];
  for (let k = 0; k < n; k++) {
    voxels.push({
      x: (seed + k) % 8,
      y: (seed * 2 + k) % 8,
      z: (seed * 3 + k) % 8,
      i: ((seed + k) % 200) + 1,
    });
  }
  return { size: [8, 8, 8], voxels };
}

describe('VoxelGrid', () => {
  test('set 增加体素, list 可枚举并保留颜色索引', () => {
    const g = new VoxelGrid(10, 10, 10);
    expect(g.length).toBe(0);
    g.set(1, 2, 3, 42);
    expect(g.length).toBe(1);
    const found = g.list().find((v) => v.x === 1 && v.y === 2 && v.z === 3);
    expect(found.i).toBe(42);
  });

  test('set 越界抛 RangeError', () => {
    const g = new VoxelGrid(10, 10, 10);
    expect(() => g.set(10, 0, 0, 1)).toThrow(RangeError);
    expect(() => g.set(0, 0, 0, 300)).toThrow(RangeError);
  });

  test('addSphere 生成非空体素', () => {
    const g = new VoxelGrid(40, 40, 44);
    g.addSphere(20, 20, 24, 14, () => 200);
    expect(g.list().length).toBeGreaterThan(0);
  });
});

describe('palette', () => {
  test('rainbowPalette 长度 256 且首元素透明', () => {
    const p = rainbowPalette();
    expect(p.length).toBe(256);
    expect(p[0][3]).toBe(0);
  });

  test('defaultPalette 长度 256', () => {
    expect(defaultPalette().length).toBe(256);
  });
});

describe('parseVox 单模型(向后兼容)', () => {
  test('toVoxBytes -> parseVox 往返一致 + 自动 identity 实例', () => {
    const grid = new VoxelGrid(8, 8, 8);
    grid.set(0, 0, 0, 1);
    grid.set(7, 7, 7, 2);
    const palette = makePalette();
    const bytes = toVoxBytes(grid, palette);
    const info = parseVox(bytes);

    expect(info.version).toBe(150);
    expect(info.models.length).toBe(1);
    expect(info.models[0].voxels.length).toBe(2);
    // 无场景图的老文件 -> 每个模型一个 identity 实例
    expect(info.scene.length).toBe(1);
    expect(info.scene[0]).toMatchObject({ modelIndex: 0, translation: [0, 0, 0], rotation: 0 });
    // 调色板往返
    expect(info.palette[1]).toEqual(palette[1]);
  });

  test('非法文件抛出', () => {
    const bad = new Uint8Array([0, 1, 2, 3, 0, 0, 0, 0]);
    expect(() => parseVox(bad)).toThrow();
  });
});

describe('场景图 + 材质 无损往返 (0.2.0 核心)', () => {
  const palette = makePalette();
  const models = [buildModel(1, 30), buildModel(5, 40)];
  const scene = [
    { modelIndex: 0, translation: [0, 0, 0], rotation: 0, hidden: false, name: 'A' },
    { modelIndex: 1, translation: [10, 0, 0], rotation: 6, hidden: false, name: 'B' },
  ];
  const materials = {
    10: { type: '_metal', metalness: 0.8, roughness: 0.3, alpha: 1, emissive: 0 },
    20: { type: '_glass', metalness: 0, roughness: 0.1, alpha: 0.5, emissive: 0.2 },
  };
  const bytes = toVoxBytesScene({ models, scene, materials }, palette);
  const back = parseVox(bytes);

  test('models 数量与体素一致', () => {
    expect(back.models.length).toBe(2);
    expect(back.models[0].voxels).toEqual(models[0].voxels);
    expect(back.models[1].voxels).toEqual(models[1].voxels);
  });

  test('scene 数组无损', () => {
    expect(back.scene).toEqual(scene);
  });

  test('materials 无损', () => {
    expect(back.materials).toEqual(materials);
  });

  test('ROTATION_MATRICES 恰为 24 个正交符号置换矩阵', () => {
    expect(ROTATION_MATRICES.length).toBe(24);
    for (const m of ROTATION_MATRICES) {
      expect(m.length).toBe(9);
      // 行列式应为 +1 (保向)
      const det =
        m[0] * (m[4] * m[8] - m[5] * m[7]) -
        m[1] * (m[3] * m[8] - m[5] * m[6]) +
        m[2] * (m[3] * m[7] - m[4] * m[6]);
      expect(det).toBe(1);
    }
  });

  test('legacy 无场景图 -> 自动生成单 identity 实例', () => {
    const legacy = parseVox(toVoxBytesScene({ models: [buildModel(2, 25)] }, palette));
    expect(legacy.scene.length).toBe(1);
    expect(legacy.scene[0].modelIndex).toBe(0);
  });
});

describe('动画 FRAM + nTRN 关键帧 无损往返 (P3 动画)', () => {
  const palette = makePalette();
  const models = [buildModel(1, 30), buildModel(5, 40), buildModel(9, 20)];
  // A: 沿 x 平移 4 帧; B: 旋转 4 帧(平移不变); C: 静态对象(动画文件里不运动)
  const scene = [
    {
      modelIndex: 0,
      translation: [0, 0, 0],
      rotation: 0,
      hidden: false,
      name: 'A',
      frames: [
        { translation: [0, 0, 0], rotation: 0 },
        { translation: [2, 0, 0], rotation: 0 },
        { translation: [4, 0, 0], rotation: 0 },
        { translation: [6, 0, 0], rotation: 0 },
      ],
    },
    {
      modelIndex: 1,
      translation: [10, 0, 0],
      rotation: 0,
      hidden: false,
      name: 'B',
      frames: [
        { translation: [10, 0, 0], rotation: 0 },
        { translation: [10, 0, 0], rotation: 1 },
        { translation: [10, 0, 0], rotation: 2 },
        { translation: [10, 0, 0], rotation: 3 },
      ],
    },
    { modelIndex: 2, translation: [0, 0, 5], rotation: 6, hidden: false, name: 'C' },
  ];
  const bytes = toVoxBytesScene({ models, scene, frameCount: 4 }, palette);
  const p1 = parseVox(bytes);

  test('frameCount 解析正确', () => {
    expect(p1.frameCount).toBe(4);
  });

  test('FRAM + 嵌套 _f 关键帧被解析为逐帧世界变换', () => {
    expect(p1.scene[0].frames).toEqual([
      { translation: [0, 0, 0], rotation: 0 },
      { translation: [2, 0, 0], rotation: 0 },
      { translation: [4, 0, 0], rotation: 0 },
      { translation: [6, 0, 0], rotation: 0 },
    ]);
    expect(p1.scene[1].frames.map((f) => f.rotation)).toEqual([0, 1, 2, 3]);
    // 旋转不改变根变换平移
    expect(p1.scene[1].frames.every((f) => f.translation.join(',') === '10,0,0')).toBe(true);
  });

  test('动画文件里的静态对象不附加 frames (保持无损)', () => {
    expect(p1.scene[2].frames).toBeUndefined();
  });

  test('二次往返场景结构完全一致 (writer->reader->writer->reader)', () => {
    const bytes2 = toVoxBytesScene(
      { models: p1.models, scene: p1.scene, materials: p1.materials, frameCount: p1.frameCount },
      p1.palette,
    );
    const p2 = parseVox(bytes2);
    expect(p2.frameCount).toBe(p1.frameCount);
    expect(p2.scene).toEqual(p1.scene);
    expect(p2.models).toEqual(p1.models);
  });
});

// ---------------------------------------------------------------------------
// Minecraft Schematic (Sponge v2) 互操作
// ---------------------------------------------------------------------------
import { parseSchematic, voxelToSchematic, parseNbt, buildNbt } from '../src/schematic.js';

describe('Schematic / NBT', () => {
  test('手写最小 NBT compound 能被解析 (规范兼容)', () => {
    // 手工拼一个极小 compound: { Version:Int2, W:Short1, H:Short1, L:Short2, Name:String"x" }
    const bytes = new Uint8Array([
      0x0a,                                     // TAG_Compound
      0x00, 0x00,                               // 根名长度 0
      0x03, 0x00, 0x07, 'V'.charCodeAt(0), 'e'.charCodeAt(0), 'r'.charCodeAt(0), 's'.charCodeAt(0), 'i'.charCodeAt(0), 'o'.charCodeAt(0), 'n'.charCodeAt(0), 0x00, 0x00, 0x00, 0x02, // Version: Int 2
      0x02, 0x00, 0x01, 'W'.charCodeAt(0), 0x00, 0x01, // W: Short 1
      0x02, 0x00, 0x01, 'H'.charCodeAt(0), 0x00, 0x01, // H: Short 1
      0x02, 0x00, 0x01, 'L'.charCodeAt(0), 0x00, 0x02, // L: Short 2
      0x08, 0x00, 0x04, 'N'.charCodeAt(0), 'a'.charCodeAt(0), 'm'.charCodeAt(0), 'e'.charCodeAt(0), 0x00, 0x01, 'x'.charCodeAt(0), // Name: String "x"
      0x00,                                     // TAG_End
    ]);
    const root = parseNbt(bytes);
    expect(root.Version).toBe(2);
    expect(root.W).toBe(1);
    expect(root.H).toBe(1);
    expect(root.L).toBe(2);
    expect(root.Name).toBe('x');
  });

  test('buildNbt 与 parseNbt 互为逆 (短整型标记)', () => {
    const compound = {
      Version: 2,
      DataVersion: 3700,
      Width: { _short: true, v: 4 },
      Height: { _short: true, v: 2 },
      Length: { _short: true, v: 3 },
      Name: 'demo',
    };
    const back = parseNbt(buildNbt(compound));
    expect(back.Version).toBe(2);
    expect(back.DataVersion).toBe(3700);
    expect(back.Width).toBe(4);
    expect(back.Height).toBe(2);
    expect(back.Length).toBe(3);
    expect(back.Name).toBe('demo');
  });

  test('手写 .schem 字节 (gzip+NBT) 正确解析块坐标与颜色', async () => {
    // 构造 2x1x1 的 schematic: W=2,H=1,L=1; 两个 block: stone(索引0), grass_block(索引1)
    // BlockData 顺序 x+z*W+y*W*L: [stone, grass] (x=0->stone, x=1->grass)
    // 但 palette 排序: 我们手动构造 root, air 不在内 (跳过空气逻辑只跳 "minecraft:air")
    const zlib = await import('node:zlib');
    const root = {
      Version: 2,
      DataVersion: 3700,
      Width: { _short: true, v: 2 },
      Height: { _short: true, v: 1 },
      Length: { _short: true, v: 1 },
      Offset: [0, 0, 0],
      Palette: { 'minecraft:stone': 0, 'minecraft:grass_block': 1 },
      BlockData: (() => {
        // varint 编码 [0, 1]
        const out = [];
        for (const v of [0, 1]) {
          let x = v;
          while (x >= 0x80) { out.push((x & 0x7f) | 0x80); x >>>= 7; }
          out.push(x);
        }
        return new Uint8Array(out);
      })(),
    };
    const nbt = buildNbt(root);
    const gz = new Uint8Array(zlib.gzipSync(Buffer.from(nbt)));
    const parsed = await parseSchematic(gz);
    expect(parsed.schematic.width).toBe(2);
    expect(parsed.schematic.height).toBe(1);
    expect(parsed.schematic.length).toBe(1);
    // 两个体素: (0,0,0) 应映射 stone 颜色 (灰 127), (1,0,0) 应映射 grass (绿 95,159,53)
    expect(parsed.models[0].voxels.length).toBe(2);
    const at0 = parsed.models[0].voxels.find((v) => v.x === 0 && v.y === 0 && v.z === 0);
    const at1 = parsed.models[0].voxels.find((v) => v.x === 1 && v.y === 0 && v.z === 0);
    expect(at0.i).not.toBe(0);
    expect(at1.i).not.toBe(0);
    // stone 灰 / grass 绿, 颜色不同
    expect(parsed.palette[at0.i]).toEqual([127, 127, 127, 255]);
    expect(parsed.palette[at1.i]).toEqual([95, 159, 53, 255]);
  });

  test('voxelToSchematic -> parseSchematic 往返一致', async () => {
    const grid = new VoxelGrid(4, 4, 4);
    grid.set(0, 0, 0, 1);
    grid.set(3, 3, 3, 2);
    const pal = rainbowPalette();
    const bytes = await voxelToSchematic({ model: { size: [4, 4, 4], voxels: grid.list() }, palette: pal });
    expect(bytes instanceof Uint8Array).toBe(true);
    expect(bytes.length).toBeGreaterThan(0);
    const back = await parseSchematic(bytes);
    expect(back.models[0].voxels.length).toBe(2);
    // 坐标必须保留
    const has00 = back.models[0].voxels.some((v) => v.x === 0 && v.y === 0 && v.z === 0);
    const has33 = back.models[0].voxels.some((v) => v.x === 3 && v.y === 3 && v.z === 3);
    expect(has00).toBe(true);
    expect(has33).toBe(true);
    // 尺寸保留
    expect(back.schematic.width).toBe(4);
    expect(back.schematic.height).toBe(4);
    expect(back.schematic.length).toBe(4);
  });
});

describe('mirrorCoordinates (P4.6 对称笔刷)', () => {
  const size = [16, 16, 16];

  test('全关: 仅返回原点本体', () => {
    const r = mirrorCoordinates(3, 4, 5, size, {});
    expect(r).toEqual([[3, 4, 5]]);
  });

  test('单轴 X: 关于中心对称平面镜像', () => {
    const r = mirrorCoordinates(3, 4, 5, size, { x: true });
    // sx-1 = 15, 15-3 = 12
    expect(r).toEqual([
      [3, 4, 5],
      [12, 4, 5],
    ]);
  });

  test('双轴 X+Y: 四角对称', () => {
    const r = mirrorCoordinates(2, 3, 7, size, { x: true, y: true });
    expect(r).toHaveLength(4);
    const set = new Set(r.map((c) => c.join(',')));
    expect(set.has('2,3,7')).toBe(true); // 原点
    expect(set.has('13,3,7')).toBe(true); // X 镜像 (15-2)
    expect(set.has('2,12,7')).toBe(true); // Y 镜像 (15-3)
    expect(set.has('13,12,7')).toBe(true); // XY 组合
  });

  test('三轴全开: 八角对称', () => {
    const r = mirrorCoordinates(1, 2, 3, size, { x: true, y: true, z: true });
    expect(r).toHaveLength(8);
    // 去重校验: 每个坐标唯一
    const set = new Set(r.map((c) => c.join(',')));
    expect(set.size).toBe(8);
  });

  test('落在对称轴上: 不重复生成 (去重)', () => {
    // 奇尺寸 [0..14] 的整数中心轴在 x=7, 7 镜像后仍是 7 -> 原点与镜像重合去重
    const r = mirrorCoordinates(7, 4, 5, [15, 15, 15], { x: true });
    const set = new Set(r.map((c) => c.join(',')));
    expect(set.size).toBe(1); // 原点与镜像重合, 去重后只剩 1 个
  });

  test('越界坐标原样返回, 由消费方裁剪', () => {
    // 边缘体素 (0,0,0) X 镜像 = 15, 不越界; 但坐标原点本身合法
    const r = mirrorCoordinates(0, 0, 0, size, { x: true });
    expect(r).toEqual([
      [0, 0, 0],
      [15, 0, 0],
    ]);
  });

  test('不同尺寸: 非正方形包围盒镜像正确', () => {
    const r = mirrorCoordinates(0, 0, 0, [4, 10, 8], { y: true });
    // sy-1 = 9
    expect(r).toEqual([
      [0, 0, 0],
      [0, 9, 0],
    ]);
  });
});

describe('voxelizeMesh (P4.5 逆向体素化)', () => {
  // 单位立方体 [-1,1]^3, 12 三角形 6 面
  function unitCube() {
    const p = {
      '000': [-1, -1, -1], '100': [1, -1, -1], '101': [1, -1, 1], '001': [-1, -1, 1],
      '010': [-1, 1, -1], '110': [1, 1, -1], '111': [1, 1, 1], '011': [-1, 1, 1],
    };
    return [
      { a: p['100'], b: p['000'], c: p['010'] }, { a: p['100'], b: p['010'], c: p['110'] },
      { a: p['001'], b: p['101'], c: p['111'] }, { a: p['001'], b: p['111'], c: p['011'] },
      { a: p['000'], b: p['001'], c: p['011'] }, { a: p['000'], b: p['011'], c: p['010'] },
      { a: p['101'], b: p['100'], c: p['110'] }, { a: p['101'], b: p['110'], c: p['111'] },
      { a: p['000'], b: p['100'], c: p['101'] }, { a: p['000'], b: p['101'], c: p['001'] },
      { a: p['010'], b: p['011'], c: p['111'] }, { a: p['010'], b: p['111'], c: p['110'] },
    ];
  }

  test('shell 模式: 单位立方体 8^3 壳 = 512 - 6^3 = 296 体素', () => {
    const { grid, palette } = voxelizeMesh(unitCube(), { resolution: 8, mode: 'shell' });
    expect(grid.sx).toBe(8);
    expect(grid.sy).toBe(8);
    expect(grid.sz).toBe(8);
    expect(grid.voxels.size).toBe(296);
    expect(palette).toHaveLength(256);
  });

  test('solid 模式: 单位立方体 8^3 全填 = 512 体素', () => {
    const { grid } = voxelizeMesh(unitCube(), { resolution: 8, mode: 'solid' });
    expect(grid.voxels.size).toBe(512);
  });

  test('pad: 包围盒外扩 1 层, 网格各轴 +2', () => {
    const { grid } = voxelizeMesh(unitCube(), { resolution: 8, pad: 1 });
    expect(grid.sx).toBe(10);
    expect(grid.voxels.size).toBe(296); // 壳体素数不变, 仅外扩空层
  });

  test('颜色量化: 两个不同色三角形 -> 调色板两个索引被覆盖', () => {
    const tris = [
      { a: [-1, -1, -1], b: [1, -1, -1], c: [0, 1, -1], color: [255, 0, 0, 255] },
      { a: [-1, 1, 1], b: [1, 1, 1], c: [0, -1, 1], color: [0, 0, 255, 255] },
    ];
    const { grid, palette } = voxelizeMesh(tris, { resolution: 16 });
    expect(grid.voxels.size).toBeGreaterThan(0);
    // 至少两个不同颜色索引存在于 palette 中被非默认值覆盖
    const used = new Set([...grid.voxels.values()]);
    expect(used.size).toBeGreaterThanOrEqual(1);
    for (const ci of used) {
      const p = palette[ci];
      expect(p[3]).toBe(255); // alpha 默认 255
    }
  });

  test('非正方形包围盒: 最长轴=resolution, 短轴按比例', () => {
    // 扁长方块 span [2,2,0.5]
    const tris = [
      { a: [-1, -1, -0.25], b: [1, -1, -0.25], c: [0, 1, -0.25] },
      { a: [-1, 1, 0.25], b: [1, 1, 0.25], c: [0, -1, 0.25] },
    ];
    const { grid } = voxelizeMesh(tris, { resolution: 8 });
    expect(grid.sx).toBe(8); // 最长轴之一
    expect(grid.sz).toBe(2); // 0.5/2 * 8 = 2
  });

  test('退化平面 (span z=0): size[2]=1 且不抛错', () => {
    const tris = [
      { a: [-1, -1, 0], b: [1, -1, 0], c: [0, 1, 0] },
    ];
    const { grid } = voxelizeMesh(tris, { resolution: 8 });
    expect(grid.sz).toBe(1);
    expect(grid.voxels.size).toBeGreaterThan(0);
  });

  test('空 triangles -> 抛错', () => {
    expect(() => voxelizeMesh([], { resolution: 8 })).toThrow();
  });

  test('显式 bounds 覆盖自动包围盒', () => {
    // 三角形很小, 但显式给大包围盒 -> 网格按 bounds 算
    const { grid } = voxelizeMesh(
      [{ a: [0, 0, 0], b: [0.1, 0, 0], c: [0, 0.1, 0] }],
      { resolution: 8, bounds: [[-1, -1, -1], [1, 1, 1]] },
    );
    expect(grid.sx).toBe(8);
  });
});

describe('voxelCSG (P4.6 余下: 布尔 CSG)', () => {
  // 构造确定性的小网格, 便于断言集合运算结果
  function gridOf(entries) {
    const g = new VoxelGrid(8, 8, 8);
    for (const [x, y, z, ci] of entries) g.set(x, y, z, ci);
    return g;
  }
  const a = gridOf([[1, 1, 1, 10], [2, 2, 2, 11], [3, 3, 3, 12]]);
  const b = gridOf([[2, 2, 2, 20], [3, 3, 3, 21], [4, 4, 4, 22]]);

  test('union: 合并两集, 冲突保留 A', () => {
    const r = voxelCSG(a, b, CSG_OP.UNION);
    expect(r.voxels.size).toBe(4); // 3 + 3 - 2 重合
    expect(r.voxels.get('1,1,1')).toBe(10);
    expect(r.voxels.get('2,2,2')).toBe(11); // A 胜
    expect(r.voxels.get('4,4,4')).toBe(22);
  });

  test('intersection: 仅保留重合, 默认保留 A 色', () => {
    const r = voxelCSG(a, b, CSG_OP.INTERSECTION);
    expect(r.voxels.size).toBe(2);
    expect(r.voxels.get('2,2,2')).toBe(11);
    expect(r.voxels.get('3,3,3')).toBe(12);
  });

  test('intersection colorTie=b: 冲突保留 B 色', () => {
    const r = voxelCSG(a, b, CSG_OP.INTERSECTION, { colorTie: 'b' });
    expect(r.voxels.get('2,2,2')).toBe(20);
    expect(r.voxels.get('3,3,3')).toBe(21);
  });

  test('difference: A 减 B, 去掉重合', () => {
    const r = voxelCSG(a, b, CSG_OP.DIFFERENCE);
    expect(r.voxels.size).toBe(1);
    expect(r.voxels.get('1,1,1')).toBe(10);
    expect(r.voxels.has('2,2,2')).toBe(false);
  });

  test('输出网格尺寸取两轴最大值 (容纳 B 越界部分)', () => {
    const small = gridOf([[0, 0, 0, 1]]);
    const big = new VoxelGrid(16, 16, 16);
    big.set(10, 10, 10, 5);
    const r = voxelCSG(small, big, CSG_OP.UNION);
    expect([r.sx, r.sy, r.sz]).toEqual([16, 16, 16]);
    expect(r.voxels.get('10,10,10')).toBe(5);
  });

  test('空集边界: A 空 -> union=B, difference=空, intersection=空', () => {
    const empty = new VoxelGrid(8, 8, 8);
    expect(voxelCSG(empty, b, CSG_OP.UNION).voxels.size).toBe(3);
    expect(voxelCSG(empty, b, CSG_OP.DIFFERENCE).voxels.size).toBe(0);
    expect(voxelCSG(empty, b, CSG_OP.INTERSECTION).voxels.size).toBe(0);
  });

  test('未知运算抛错', () => {
    expect(() => voxelCSG(a, b, 'xor')).toThrow();
  });

  test('非 VoxelGrid 操作数抛 TypeError', () => {
    expect(() => voxelCSG({}, b, CSG_OP.UNION)).toThrow(TypeError);
  });

  test('gridFromMap: Map 规整为 VoxelGrid', () => {
    const m = new Map([['1,2,3', 7], ['0,0,0', 1]]);
    const g = gridFromMap(m, [8, 8, 8]);
    expect(g.voxels.get('1,2,3')).toBe(7);
    expect(g.length).toBe(2);
  });
});
