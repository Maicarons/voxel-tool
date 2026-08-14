import { useState } from 'react';
import type { LayerInfo } from '../editor';

interface Props {
  layers: LayerInfo[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onToggleVisible: (index: number, visible: boolean) => void;
  onOpacity: (index: number, opacity: number) => void;
  onSelect: (index: number) => void;
  onRename: (index: number, name: string) => void;
}

export default function LayersPanel({
  layers,
  onAdd,
  onRemove,
  onMove,
  onToggleVisible,
  onOpacity,
  onSelect,
  onRename,
}: Props) {
  const [editing, setEditing] = useState<number | null>(null);

  return (
    <div className="layers-panel">
      <div className="panel-head">
        <span className="panel-title">图层</span>
        <button className="btn btn-sm" onClick={onAdd} title="新增空白图层">
          + 图层
        </button>
      </div>

      <div className="layer-list">
        {layers.length === 0 && <div className="layer-empty">无图层</div>}
        {[...layers].reverse().map((l, ri) => {
          // 列表倒序显示 (顶层在上), 但回调使用真实 index
          const index = layers.length - 1 - ri;
          return (
            <div
              key={l.id}
              className={'layer-item' + (l.active ? ' active' : '')}
              onClick={() => onSelect(index)}
            >
              <button
                className={'eye' + (l.visible ? ' on' : '')}
                title={l.visible ? '隐藏图层' : '显示图层'}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleVisible(index, !l.visible);
                }}
              >
                {l.visible ? '👁' : '—'}
              </button>

              {editing === index ? (
                <input
                  className="layer-name-input"
                  autoFocus
                  defaultValue={l.name}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => {
                    onRename(index, e.target.value || l.name);
                    setEditing(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                />
              ) : (
                <span
                  className="layer-name"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditing(index);
                  }}
                  title="双击重命名"
                >
                  {l.name}
                </span>
              )}

              <span className="layer-count">{l.count}</span>

              <div className="layer-ops" onClick={(e) => e.stopPropagation()}>
                <button className="layer-op" title="上移" onClick={() => onMove(index, -1)}>
                  ▲
                </button>
                <button className="layer-op" title="下移" onClick={() => onMove(index, 1)}>
                  ▼
                </button>
                <button
                  className="layer-op"
                  title="删除图层"
                  disabled={layers.length <= 1}
                  onClick={() => onRemove(index)}
                >
                  ✕
                </button>
              </div>

              {/* 不透明度滑块 (非破坏式: 仅影响渲染, 不丢失数据) */}
              <input
                className="layer-opacity"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={l.opacity}
                title={`不透明度 ${(l.opacity * 100).toFixed(0)}%`}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => onOpacity(index, Number(e.target.value))}
              />
            </div>
          );
        })}
      </div>
      <div className="layer-hint">单击选中 · 双击重命名 · 滑块调透明度</div>
    </div>
  );
}
