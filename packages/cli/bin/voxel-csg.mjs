#!/usr/bin/env node
// bin/voxel-csg.mjs —— Node headless 体素布尔 CSG (并/交/差) CLI 入口 (P4.6 余下).
//
// 对两个体素文件执行布尔运算并写回 .vox. 真正的逻辑在 ../src/export.mjs 的 csgVoxFiles。
// 用法见 --help。
import { parseArgs } from 'node:util';
import { csgVoxFiles } from '../src/export.mjs';

const HELP = `voxel-csg — 体素布尔运算 (并/交/差) (headless, Node)

用法:
  voxel-csg <op> <a.vox> <b.vox> [options]

参数:
  <op>            运算: union(并) | intersection(交) | difference(差, a 减 b)
  <a.vox>         主操作数 (.vox / .schem)
  <b.vox>         次操作数 (.vox / .schem)

选项:
  -o, --output <path>   输出 .vox 路径 (默认 <a>_<op>_<b>.vox)
      --tie <a|b>       冲突处颜色归属, 默认 a (保留主操作数颜色)
  -h, --help            显示本帮助

示例:
  voxel-csg union a.vox b.vox -o merged.vox
  voxel-csg difference a.vox b.vox        # 从 a 减掉 b (挖洞效果)
  voxel-csg intersection a.vox b.vox       # 取两者重合部分
`;

function fail(msg) {
  process.stderr.write(`错误: ${msg}\n`);
  process.stderr.write('用 voxel-csg --help 查看用法。\n');
  process.exit(1);
}

let parsed;
try {
  parsed = parseArgs({
    args: process.argv.slice(2),
    options: {
      output: { type: 'string', short: 'o' },
      tie: { type: 'string' },
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

const op = positionals[0];
const aPath = positionals[1];
const bPath = positionals[2];

if (!op || !aPath || !bPath) {
  process.stderr.write(HELP);
  process.exit(1);
}
if (!['union', 'intersection', 'difference'].includes(op)) {
  fail(`未知运算 "${op}" (应为 union|intersection|difference)`);
}
if (values.tie && !['a', 'b'].includes(values.tie)) {
  fail(`--tie 必须是 a 或 b`);
}

try {
  const { outputPath, bytes, count } = await csgVoxFiles(aPath, bPath, op, {
    output: values.output,
    colorTie: values.tie || 'a',
  });
  process.stdout.write(`已执行 ${op}: ${outputPath} (${bytes.length} 字节, ${count} 体素)\n`);
} catch (e) {
  fail(e.message);
}
