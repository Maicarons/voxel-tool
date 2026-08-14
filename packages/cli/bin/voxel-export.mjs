#!/usr/bin/env node
// bin/voxel-export.mjs —— Node headless 体素导出 CLI 入口.
//
// 只负责参数解析 / 退出码 / 文案, 真正的转换逻辑在 ../src/export.mjs。
// 双向支持:
//   正向: .vox/.schem -> 通用 3D 格式 (glb/gltf/obj/stl/ply/usdz/fbx/schem/vox)
//   逆向: .glb/.gltf/.obj/.stl -> .vox (P4.5 逆向体素化)
// 用法见 --help。
import { parseArgs } from 'node:util';
import { exportVoxFile, listFormats, voxelizeModel, isMeshInput } from '../src/export.mjs';

const HELP = `voxel-export — 体素 <-> 通用 3D 格式双向转换 (headless, Node)

用法:
  voxel-export <input> [options]

参数:
  <input>               输入文件路径 (.vox / .schem / .glb / .gltf / .obj / .stl)

正向 (vox/schem -> 通用 3D):
  -f, --format <fmt>    导出格式: ${listFormats().join(', ')} (默认 glb)
  -o, --output <path>   输出文件路径 (默认 <输入名去扩展>.glb)
      --ascii           文本格式 stl/ply 用 ASCII 而非二进制 (默认二进制)
  -d, --draco           导出 glb/gltf 时启用 Draco 几何压缩 (体积通常 10×+ 缩小, 保留材质+动画)

逆向 (网格 -> vox, P4.5):
  -r, --resolution <n>  体素化分辨率 (最大维度体素数, 默认 64; 也可传 nx,ny,nz)
      --solid           实心模式 (需封闭流形网格); 默认 shell 表面壳
      --pad <n>         包围盒外扩层数 (留空 margin, 默认 0)
  -o, --output <path>   输出 .vox 路径 (默认 <输入名去扩展>.vox)

其它:
  -l, --list            列出支持的格式后退出
  -h, --help            显示本帮助后退出

示例:
  voxel-export model.vox
  voxel-export model.vox -f obj -o model.obj
  voxel-export model.vox -f fbx
  voxel-export model.vox -f stl --ascii
  voxel-export model.vox -f schem -o model.schem     # 导出为 Minecraft  schematic
  voxel-export model.schem -f glb -o model.glb        # 从 Minecraft schematic 转 GLB
  voxel-export model.vox -d                           # 导出 Draco 压缩的 GLB
  voxel-export model.glb -r 96 -o model.vox           # 逆向体素化 GLB -> VOX (分辨率 96)
  voxel-export model.stl --solid -r 48 -o model.vox   # 实心模式体素化 STL
`;

function fail(msg) {
  process.stderr.write(`错误: ${msg}\n`);
  process.stderr.write('用 voxel-export --help 查看用法。\n');
  process.exit(1);
}

function parseResolution(value) {
  if (value === undefined) return 64;
  if (value.includes(',')) {
    const parts = value.split(',').map((s) => parseInt(s, 10));
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n) || n < 1)) {
      throw new Error(`分辨率 "${value}" 无效, 应为单个整数或 nx,ny,nz`);
    }
    return parts;
  }
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) throw new Error(`分辨率 "${value}" 无效`);
  return n;
}

let parsed;
try {
  parsed = parseArgs({
    args: process.argv.slice(2),
    options: {
      format: { type: 'string', short: 'f' },
      output: { type: 'string', short: 'o' },
      ascii: { type: 'boolean' },
      draco: { type: 'boolean', short: 'd' },
      resolution: { type: 'string', short: 'r' },
      solid: { type: 'boolean' },
      pad: { type: 'string' },
      list: { type: 'boolean', short: 'l' },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
  });
} catch (e) {
  fail(e.message);
}

const { values, positionals } = parsed;

if (values.help) {
  process.stdout.write(HELP);
  process.exit(0);
}

if (values.list) {
  process.stdout.write(listFormats().join('\n') + '\n');
  process.exit(0);
}

const input = positionals[0];
if (!input) {
  process.stderr.write(HELP);
  process.exit(1);
}

try {
  if (isMeshInput(input)) {
    // 逆向体素化: 网格 -> .vox
    let pad = 0;
    if (values.pad !== undefined) {
      pad = parseInt(values.pad, 10);
      if (!Number.isFinite(pad) || pad < 0) fail(`pad "${values.pad}" 无效`);
    }
    const { outputPath, bytes } = await voxelizeModel(input, {
      output: values.output,
      resolution: parseResolution(values.resolution),
      mode: values.solid ? 'solid' : 'shell',
      pad,
    });
    process.stdout.write(`已体素化: ${outputPath} (${bytes.length} 字节)\n`);
  } else {
    // 正向: vox/schem -> 通用 3D / 体素互操作
    const { outputPath, bytes } = await exportVoxFile(input, {
      format: values.format || 'glb',
      output: values.output,
      ascii: !!values.ascii,
      draco: !!values.draco,
    });
    process.stdout.write(`已导出: ${outputPath} (${bytes.length} 字节)\n`);
  }
} catch (e) {
  fail(e.message);
}
