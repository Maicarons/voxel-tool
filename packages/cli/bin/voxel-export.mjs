#!/usr/bin/env node
// bin/voxel-export.mjs —— Node headless 体素导出 CLI 入口.
//
// 只负责参数解析 / 退出码 / 文案, 真正的转换逻辑在 ../src/export.mjs。
// 用法见 --help。
import { parseArgs } from 'node:util';
import { exportVoxFile, listFormats } from '../src/export.mjs';

const HELP = `voxel-export — 把 MagicaVoxel .vox 转成通用 3D 格式 (headless, Node)

用法:
  voxel-export <input.vox> [options]

参数:
  <input.vox>           输入 .vox 文件路径

选项:
  -f, --format <fmt>    导出格式: ${listFormats().join(', ')} (默认 glb)
  -o, --output <path>   输出文件路径 (默认 <输入名去扩展>.glb)
      --ascii           文本格式 stl/ply 用 ASCII 而非二进制 (默认二进制)
  -l, --list            列出支持的格式后退出
  -h, --help            显示本帮助后退出

示例:
  voxel-export model.vox
  voxel-export model.vox -f obj -o model.obj
  voxel-export model.vox -f fbx
  voxel-export model.vox -f stl --ascii
`;

function fail(msg) {
  process.stderr.write(`错误: ${msg}\n`);
  process.stderr.write('用 voxel-export --help 查看用法。\n');
  process.exit(1);
}

let parsed;
try {
  parsed = parseArgs({
    args: process.argv.slice(2),
    options: {
      format: { type: 'string', short: 'f' },
      output: { type: 'string', short: 'o' },
      ascii: { type: 'boolean' },
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
  const { outputPath, bytes } = await exportVoxFile(input, {
    format: values.format || 'glb',
    output: values.output,
    ascii: !!values.ascii,
  });
  process.stdout.write(`已导出: ${outputPath} (${bytes.length} 字节)\n`);
} catch (e) {
  fail(e.message);
}
