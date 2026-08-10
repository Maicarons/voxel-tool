import type { EditMode } from '../editor';

interface Props {
  mode: EditMode;
  setMode: (m: EditMode) => void;
  onNew: () => void;
  onOpenClick: () => void;
  onSave: () => void;
  onExportPng: () => void;
  onUndo: () => void;
  canUndo: boolean;
  onClear: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  fileName: string;
}

export default function Toolbar({
  mode,
  setMode,
  onNew,
  onOpenClick,
  onSave,
  onExportPng,
  onUndo,
  canUndo,
  onClear,
  showGrid,
  onToggleGrid,
  fileName,
}: Props) {
  return (
    <div className="toolbar">
      <div className="tool-group">
        <button className="btn" onClick={onNew} title="新建空模型">
          新建
        </button>
        <button className="btn" onClick={onOpenClick} title="打开 .vox 文件">
          打开
        </button>
        <button className="btn" onClick={onSave} title="导出为 .vox">
          保存 .vox
        </button>
        <button className="btn" onClick={onExportPng} title="导出当前视角为 PNG">
          导出 PNG
        </button>
      </div>

      <div className="tool-group">
        <div className="seg">
          <button
            className={'seg-btn' + (mode === 'paint' ? ' active' : '')}
            onClick={() => setMode('paint')}
          >
            绘制
          </button>
          <button
            className={'seg-btn' + (mode === 'erase' ? ' active' : '')}
            onClick={() => setMode('erase')}
          >
            擦除
          </button>
        </div>
        <button className="btn" onClick={onUndo} disabled={!canUndo} title="撤销 (最多 100 步)">
          撤销
        </button>
        <button className="btn" onClick={onClear} title="清空所有体素">
          清空
        </button>
        <button className={'btn' + (showGrid ? ' active' : '')} onClick={onToggleGrid}>
          网格
        </button>
      </div>

      <div className="tool-group tool-right">
        <span className="filename" title={fileName}>
          {fileName}
        </span>
        <span className="hint">左键绘制 · 拖拽旋转 · 滚轮缩放 · Shift/Alt+点击取色</span>
      </div>
    </div>
  );
}
