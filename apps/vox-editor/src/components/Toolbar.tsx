import { useState } from 'react';
import type { EditMode, VoxelFormat } from '../editor';

const FORMAT_OPTIONS: { value: VoxelFormat; label: string }[] = [
  { value: 'glb', label: 'GLB' },
  { value: 'gltf', label: 'glTF' },
  { value: 'obj', label: 'OBJ' },
  { value: 'stl', label: 'STL' },
  { value: 'ply', label: 'PLY' },
  { value: 'usdz', label: 'USDZ' },
  { value: 'fbx', label: 'FBX' },
];

interface Props {
  mode: EditMode;
  setMode: (m: EditMode) => void;
  onNew: () => void;
  onOpenClick: () => void;
  onSave: () => void;
  onExportPng: () => void;
  onExportModel: (format: VoxelFormat) => void;
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
  onExportModel,
  onUndo,
  canUndo,
  onClear,
  showGrid,
  onToggleGrid,
  fileName,
}: Props) {
  const [exportFmt, setExportFmt] = useState<VoxelFormat>('glb');

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
        <select
          className="export-select"
          value={exportFmt}
          onChange={(e) => setExportFmt(e.target.value as VoxelFormat)}
          title="选择导出格式"
        >
          {FORMAT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          className="btn"
          onClick={() => onExportModel(exportFmt)}
          title="把当前体素模型导出为通用 3D 格式并下载"
        >
          导出模型
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
