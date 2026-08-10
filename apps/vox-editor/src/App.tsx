import { useEffect, useRef, useState } from 'react';
import { VoxelEditor, type EditMode, type EditorStats } from './editor';
import { defaultPalette } from '@voxel-tool/core';
import Toolbar from './components/Toolbar';
import PalettePanel from './components/PalettePanel';
import InfoPanel from './components/InfoPanel';

const PALETTE = defaultPalette();

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<VoxelEditor | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<EditMode>('paint');
  const [currentColor, setCurrentColor] = useState(1);
  const [stats, setStats] = useState<EditorStats>({ count: 0, size: [24, 24, 24] });
  const [showGrid, setShowGrid] = useState(true);
  const [fileName, setFileName] = useState('model.vox');
  const [canUndo, setCanUndo] = useState(false);

  // 初始化编辑器
  useEffect(() => {
    if (!containerRef.current) return;
    const editor = new VoxelEditor(containerRef.current, {
      onStats: (s) => setStats(s),
      onColorPicked: (ci) => setCurrentColor(ci),
      onUndoChange: (c) => setCanUndo(c),
    });
    editorRef.current = editor;
    editor.loadDemo(); // 首次打开显示一个彩色球体 demo
    return () => {
      editor.dispose();
      editorRef.current = null;
    };
  }, []);

  // 同步模式 / 颜色 / 网格 到引擎
  useEffect(() => {
    editorRef.current?.setMode(mode);
  }, [mode]);
  useEffect(() => {
    editorRef.current?.setColor(currentColor);
  }, [currentColor]);

  const onNew = () => {
    editorRef.current?.newModel(24, 24, 24);
    setFileName('model.vox');
  };
  const onOpenFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        editorRef.current?.loadVox(reader.result as ArrayBuffer);
        setFileName(file.name);
      } catch (err) {
        alert('无法解析 VOX 文件: ' + (err as Error).message);
      }
    };
    reader.readAsArrayBuffer(file);
  };
  const onSave = () => editorRef.current?.exportVox(fileName);
  const onExportPng = () =>
    editorRef.current?.exportPng(fileName.replace(/\.vox$/i, '') + '.png');
  const onClear = () => editorRef.current?.clear();
  const onUndo = () => editorRef.current?.undo();
  const onToggleGrid = () => {
    const v = !showGrid;
    setShowGrid(v);
    editorRef.current?.setShowGrid(v);
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-dot" />
          <div>
            <div className="brand-title">Voxel Editor</div>
            <div className="brand-sub">.vox 体素编辑器</div>
          </div>
        </div>

        <PalettePanel palette={PALETTE} currentColor={currentColor} onSelect={setCurrentColor} />

        <InfoPanel stats={stats} mode={mode} currentColor={currentColor} palette={PALETTE} />
      </aside>

      <main className="viewport">
        <Toolbar
          mode={mode}
          setMode={setMode}
          onNew={onNew}
          onOpenClick={() => fileInputRef.current?.click()}
          onSave={onSave}
          onExportPng={onExportPng}
          onUndo={onUndo}
          canUndo={canUndo}
          onClear={onClear}
          showGrid={showGrid}
          onToggleGrid={onToggleGrid}
          fileName={fileName}
        />
        <div className="canvas-wrap" ref={containerRef} />
      </main>

      <input
        ref={fileInputRef}
        type="file"
        accept=".vox"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onOpenFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
