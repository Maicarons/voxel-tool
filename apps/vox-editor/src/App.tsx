import { useEffect, useRef, useState } from 'react';
import { VoxelEditor, type EditMode, type EditorStats, type VoxelFormat, type LayerInfo } from './editor';
import { defaultPalette, parseVox, VoxelGrid } from '@voxel-tool/core';
import Toolbar from './components/Toolbar';
import PalettePanel from './components/PalettePanel';
import InfoPanel from './components/InfoPanel';
import LayersPanel from './components/LayersPanel';

const PALETTE = defaultPalette();

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<VoxelEditor | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csgInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<EditMode>('paint');
  const [currentColor, setCurrentColor] = useState(1);
  const [stats, setStats] = useState<EditorStats>({ count: 0, size: [24, 24, 24] });
  const [showGrid, setShowGrid] = useState(true);
  const [symmetry, setSymmetry] = useState<{ x: boolean; y: boolean; z: boolean }>({
    x: false,
    y: false,
    z: false,
  });
  const [fileName, setFileName] = useState('model.vox');
  const [canUndo, setCanUndo] = useState(false);
  const [layers, setLayers] = useState<LayerInfo[]>([]);
  const [csgOp, setCsgOp] = useState<'union' | 'intersection' | 'difference'>('union');
  const [backend, setBackend] = useState<'webgpu' | 'webgl'>('webgl');
  const [tslOn, setTslOn] = useState(false);

  // 初始化编辑器
  useEffect(() => {
    if (!containerRef.current) return;
    const editor = new VoxelEditor(
      containerRef.current,
      {
        onStats: (s) => setStats(s),
        onColorPicked: (ci) => setCurrentColor(ci),
        onUndoChange: (c) => setCanUndo(c),
        onLayersChange: (ls) => setLayers(ls),
        onBackend: (b) => setBackend(b),
      },
      // P4.7: 默认尝试 WebGPU, 浏览器不支持时引擎自动回退 WebGL2
      { renderer: 'webgpu' },
    );
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
  const onToggleSymmetry = (axis: 'x' | 'y' | 'z') => {
    const v = !symmetry[axis];
    setSymmetry((s) => ({ ...s, [axis]: v }));
    editorRef.current?.setSymmetry(axis, v);
  };

  // ---- TSL 描边 / 自发光增强 (P4.6 余下) ----
  // 仅 WebGPU 后端支持完整 TSL 节点材质 (NodeMaterial); WebGL 回退仅降级应用自发光。
  const onToggleTsl = () => {
    const next = !tslOn;
    setTslOn(next);
    editorRef.current?.setTsl(
      next
        ? {
            outline: true,
            outlineColor: [0, 0, 0],
            outlinePower: 3,
            outlineStrength: 1,
            emissive: [0.16, 0.16, 0.22],
            emissiveIntensity: 0.6,
          }
        : null,
    );
  };

  // ---- 图层 (P4.6 余下: 非破坏式编辑) ----
  const onAddLayer = () => editorRef.current?.addLayer();
  const onRemoveLayer = (index: number) => editorRef.current?.removeLayer(index);
  const onMoveLayer = (index: number, dir: -1 | 1) => editorRef.current?.moveLayer(index, dir);
  const onToggleLayerVisible = (index: number, visible: boolean) =>
    editorRef.current?.setLayerVisible(index, visible);
  const onLayerOpacity = (index: number, opacity: number) =>
    editorRef.current?.setLayerOpacity(index, opacity);
  const onSelectLayer = (index: number) => editorRef.current?.setActiveLayer(index);
  const onRenameLayer = (index: number, name: string) => editorRef.current?.setLayerName(index, name);

  // ---- 布尔 CSG (P4.6 余下) ----
  const onApplyCsg = () => csgInputRef.current?.click();
  const onCsgFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { models } = parseVox(reader.result as ArrayBuffer);
        const m = models[0];
        if (!m) throw new Error('VOX 文件不含模型');
        const grid = new VoxelGrid(m.size[0], m.size[1], m.size[2]);
        for (const v of m.voxels) grid.voxels.set(`${v.x},${v.y},${v.z}`, v.i);
        editorRef.current?.booleanOp(csgOp, grid);
        setFileName(`csg_${csgOp}_${file.name}`);
      } catch (err) {
        alert('CSG 失败: ' + (err as Error).message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const onExportModel = (format: VoxelFormat) =>
    editorRef.current
      ?.exportModel(format, fileName.replace(/\.vox$/i, '') || 'model')
      .catch((err) => alert('导出失败: ' + (err as Error).message));

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

        <LayersPanel
          layers={layers}
          onAdd={onAddLayer}
          onRemove={onRemoveLayer}
          onMove={onMoveLayer}
          onToggleVisible={onToggleLayerVisible}
          onOpacity={onLayerOpacity}
          onSelect={onSelectLayer}
          onRename={onRenameLayer}
        />

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
          onExportModel={onExportModel}
          onUndo={onUndo}
          canUndo={canUndo}
          onClear={onClear}
          showGrid={showGrid}
          onToggleGrid={onToggleGrid}
          symmetry={symmetry}
          onToggleSymmetry={onToggleSymmetry}
          fileName={fileName}
          csgOp={csgOp}
          setCsgOp={setCsgOp}
          onApplyCsg={onApplyCsg}
          backend={backend}
          tslOn={tslOn}
          onToggleTsl={onToggleTsl}
        />
        <div className="canvas-wrap" ref={containerRef}>
          <div className={'backend-badge' + (backend === 'webgpu' ? ' webgpu' : ' webgl')}>
            {backend === 'webgpu' ? 'WebGPU' : 'WebGL2'}
          </div>
        </div>
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
      <input
        ref={csgInputRef}
        type="file"
        accept=".vox"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onCsgFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
