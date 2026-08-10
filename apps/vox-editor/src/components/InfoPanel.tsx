import type { EditorStats } from '../editor';
import type { EditMode } from '../editor';

interface Props {
  stats: EditorStats;
  mode: EditMode;
  currentColor: number;
  palette: number[][];
}

function cssColor(c: number[]): string {
  const a = c.length > 3 ? c[3] / 255 : 1;
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
}

export default function InfoPanel({ stats, mode, currentColor, palette }: Props) {
  const [sx, sy, sz] = stats.size;
  const fillPct = ((stats.count / (sx * sy * sz)) * 100).toFixed(2);
  return (
    <div className="info">
      <div className="panel-head">模型信息</div>
      <div className="info-row">
        <span>体素数量</span>
        <b>{stats.count}</b>
      </div>
      <div className="info-row">
        <span>尺寸 (X·Y·Z)</span>
        <b>
          {sx} × {sy} × {sz}
        </b>
      </div>
      <div className="info-row">
        <span>填充率</span>
        <b>{fillPct}%</b>
      </div>
      <div className="info-row">
        <span>当前模式</span>
        <b>{mode === 'paint' ? '绘制' : '擦除'}</b>
      </div>
      <div className="info-row">
        <span>当前颜色</span>
        <b className="inline">
          <span className="info-chip" style={{ background: cssColor(palette[currentColor] || [0, 0, 0, 0]) }} />
          #{currentColor}
        </b>
      </div>
    </div>
  );
}
