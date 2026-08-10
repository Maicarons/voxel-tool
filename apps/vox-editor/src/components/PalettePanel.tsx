interface Props {
  palette: number[][];
  currentColor: number;
  onSelect: (ci: number) => void;
}

function cssColor(c: number[]): string {
  const a = c.length > 3 ? c[3] / 255 : 1;
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
}

export default function PalettePanel({ palette, currentColor, onSelect }: Props) {
  // 调色板 0 号通常为全透明, 跳过
  const colors = palette.map((c, i) => ({ i, c })).filter(({ c }) => c[3] > 0 || c[0] + c[1] + c[2] > 0);
  return (
    <div className="palette-wrap">
      <div className="panel-head">
        调色板
        <span className="current-chip" style={{ background: cssColor(palette[currentColor] || [0, 0, 0, 0]) }} />
        <span className="current-idx">#{currentColor}</span>
      </div>
      <div className="palette">
        {colors.map(({ i, c }) => (
          <button
            key={i}
            className={'swatch' + (i === currentColor ? ' selected' : '')}
            style={{ background: cssColor(c) }}
            title={`颜色 #${i}`}
            onClick={() => onSelect(i)}
          />
        ))}
      </div>
    </div>
  );
}
