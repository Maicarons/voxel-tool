import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  VoxelGrid,
  RGBA,
  parseVox,
  toVoxBytes,
  downloadVox,
  defaultPalette,
  mirrorCoordinates,
  voxelCSG,
} from '@voxel-tool/core';
import { VoxelExporter, applyVoxelTsl } from '@voxel-tool/exporter';
import type { VoxelFormat } from '@voxel-tool/exporter';
import { EditorUndoStack } from './undo';

// 重新导出供 UI 层 (Toolbar / App) 引用, 避免重复 import 第三方包
export type { VoxelFormat } from '@voxel-tool/exporter';

export type EditMode = 'paint' | 'erase';

/** 图层非破坏式编辑 (P4.6 余下): 每个图层是一个独立体素网格, 可单独显隐/调透明度/重排 */
export interface EditorLayer {
  id: number;
  name: string;
  visible: boolean;
  /** 0..1, 1=不透明 */
  opacity: number;
  grid: VoxelGrid;
}

export interface LayerInfo {
  id: number;
  name: string;
  visible: boolean;
  opacity: number;
  count: number;
  active: boolean;
}

export interface EditorStats {
  count: number;
  size: [number, number, number];
}

export interface EditorCallbacks {
  onStats?: (s: EditorStats) => void;
  onColorPicked?: (ci: number) => void;
  onUndoChange?: (canUndo: boolean) => void;
  /** 图层列表变化 (增/删/重排/显隐/改名) 时回调, 供 UI 同步 */
  onLayersChange?: (layers: LayerInfo[]) => void;
  /** 实际渲染后端确定/回退时回调 ('webgpu' | 'webgl'), 供 UI 显示当前后端 */
  onBackend?: (backend: 'webgpu' | 'webgl') => void;
}

/** TSL 描边 / 自发光增强选项 (mesh.applyVoxelTsl) */
export interface TslOptions {
  /** 是否启用 fresnel 边缘描边 (边缘辉光, 近似描边) */
  outline?: boolean;
  /** 描边颜色, 0..1 归一化 RGB (默认黑边 [0,0,0]) */
  outlineColor?: [number, number, number];
  /** fresnel 指数 (默认 3, 越大边缘越锐) */
  outlinePower?: number;
  /** 描边强度 (默认 1) */
  outlineStrength?: number;
  /** 自发光颜色, 0..1 归一化 RGB (默认不启用) */
  emissive?: [number, number, number];
  /** 自发光强度 (默认 1) */
  emissiveIntensity?: number;
}

/** 编辑器构造选项 (与 EditorCallbacks 分离: 配置项, 非事件) */
export interface EditorOptions {
  /** 渲染后端: 默认 'webgpu' (不可用时自动回退 WebGL2) | 'webgl'(强制经典路径) */
  renderer?: 'webgl' | 'webgpu';
  /** 初始 TSL 增强 (可后续用 setTsl 动态改) */
  tsl?: TslOptions | null;
}

/**
 * 渲染器结构类型: WebGLRenderer 与 WebGPURenderer 共享同一调用面
 * (render/setSize/setPixelRatio/domElement/dispose)。用结构化类型而非导入 three/webgpu,
 * 避免把 WebGPU 类型/运行时引入编辑器类型图 (WebGPU 类仅通过动态 import 在运行时按需加载)。
 */
type AnyRenderer = {
  render(scene: THREE.Scene, camera: THREE.Camera): unknown;
  setSize(w: number, h: number): void;
  setPixelRatio(ratio: number): void;
  getPixelRatio(): number;
  domElement: HTMLCanvasElement;
  dispose(): void;
  renderAsync?(scene: THREE.Scene, camera: THREE.Camera): Promise<void>;
};

const SHARED_BOX = new THREE.BoxGeometry(1, 1, 1);
const keyOf = (x: number, y: number, z: number) => `${x},${y},${z}`;

/**
 * 框架无关的体素编辑器引擎 (基于 Three.js)。
 * - 体素模型保存在多层 VoxelGrid (来自 @voxel-tool/core), 支持非破坏式图层编辑 (P4.6 余下)
 * - 每个体素是一个 BoxGeometry mesh, 用 face normal 推算相邻空格, 支持点击绘制/擦除
 * - z-up (MagicaVoxel 坐标系) 通过 voxelsGroup.rotation.x = -90° 转为 three 的 y-up
 * - 按调色板颜色 + 图层分组渲染 (InstancedMesh): draw call 降到 "图层数 × 颜色数"
 */
export class VoxelEditor {
  private container: HTMLElement;
  /** 当前承载交互的画布 (WebGPU 热替换后会指向新画布, 指针监听器需随之迁移) */
  private canvas: HTMLCanvasElement;
  private renderer: AnyRenderer;
  private backend: 'webgl' | 'webgpu' = 'webgl';
  /** WebGPU 热替换成功后才可用 (MeshStandardNodeMaterial), 用于 TSL 节点材质 */
  private nodeMatClass: any = null;
  private tsl: TslOptions | null = null;
  private opts: EditorOptions = {};
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private voxelsGroup: THREE.Group;
  private groundPlane: THREE.Mesh;
  private gridHelper: THREE.GridHelper;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private materialCache = new Map<string, THREE.MeshStandardMaterial>();
  // 按 "图层id:颜色索引" 分组的 InstancedMesh (单组单 draw call), 取代早期每体素一个 Mesh。
  private instanceGroups = new Map<
    string,
    { mesh: THREE.InstancedMesh; coordMap: Map<number, string>; layerId: number; ci: number }
  >();
  private dirty = new Set<string>(); // 待重建组键 "layerId:ci"
  /** P4.6 余下: 非破坏式图层。绘制/擦除只作用于 activeLayer。 */
  private layers: EditorLayer[] = [];
  private activeLayer = 0;
  private nextLayerId = 1;
  private palette: RGBA[];
  private mode: EditMode = 'paint';
  private currentColor = 1;
  private showGrid = true;
  /** P4.6 对称笔刷: 各轴是否开启镜像 (默认全关) */
  private symmetry = { x: false, y: false, z: false };
  private undoStack = new EditorUndoStack();
  private cb: EditorCallbacks;
  private resizeObserver: ResizeObserver;
  private rafId = 0;
  private downPos = new THREE.Vector2();
  private downTime = 0;
  private defaultSize = 24;

  constructor(container: HTMLElement, cb: EditorCallbacks = {}, options: EditorOptions = {}) {
    this.container = container;
    this.cb = cb;
    this.opts = options;
    this.tsl = options?.tsl ?? null;
    this.palette = defaultPalette();
    this.layers = [{ id: 0, name: 'Layer 1', visible: true, opacity: 1, grid: new VoxelGrid(this.defaultSize, this.defaultSize, this.defaultSize) }];

    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x16161a);

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 5000);
    this.camera.position.set(30, 30, 30);

    // 渲染器: 默认尝试 WebGPU (P4.7 生产化), 不可用时自动回退 WebGL2。
    // 先同步创建 WebGL 占位渲染器, 保证布局/尺寸就绪 + animate 循环立即可渲染;
    // 随后 initWebGPURenderer 异步尝试 WebGPURenderer, 成功则热替换 (TSL 需 NodeMaterial), 失败保留 WebGL。
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.touchAction = 'none';
    container.appendChild(canvas);
    this.canvas = canvas;

    this.controls = new OrbitControls(this.camera, canvas);
    this.applyControlConstraints(this.controls);

    this.attachPointerListeners(this.canvas);

    this.initWebGPURenderer();

    // 光照 (与 viewer 类似: 半球光 + 两盏方向光)
    const hemi = new THREE.HemisphereLight(0xffffff, 0x404050, 1.0);
    hemi.position.set(0, 1, 0);
    this.scene.add(hemi);
    const dir1 = new THREE.DirectionalLight(0xffffff, 1.4);
    dir1.position.set(1, 2, 1.5);
    this.scene.add(dir1);
    const dir2 = new THREE.DirectionalLight(0xffffff, 0.55);
    dir2.position.set(-1.5, -0.5, -1);
    this.scene.add(dir2);

    // 体素组 (z-up -> y-up)
    this.voxelsGroup = new THREE.Group();
    this.voxelsGroup.rotation.x = -Math.PI / 2;
    this.scene.add(this.voxelsGroup);

    // 地面 (承接首次点击, 在 vox y = -0.5 平面)
    const gpMat = new THREE.MeshBasicMaterial({
      color: 0x6b7280,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
    });
    this.groundPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), gpMat);
    this.groundPlane.rotation.x = -Math.PI / 2; // 平放, 法线 +Y (vox 向上)
    this.groundPlane.userData.isGround = true;
    this.voxelsGroup.add(this.groundPlane);

    // 参考网格
    this.gridHelper = new THREE.GridHelper(1, 1, 0x555560, 0x2c2c33);
    this.gridHelper.userData.isGrid = true;
    this.voxelsGroup.add(this.gridHelper);

    this.updateGroundAndGrid();

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup', this.onPointerUp);

    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(container);

    // 首帧后再校正一次尺寸 (布局可能晚于构造完成)
    requestAnimationFrame(() => this.onResize());

    this.animate();
  }

  /** 当前激活图层的体素网格 (绘制/擦除的目标) */
  /**
   * 异步初始化 WebGPU 渲染器 (P4.7 生产化): 默认尝试 WebGPU, 失败/不支持则回退 WebGL2。
   * WebGPURenderer 通过动态 import('three/webgpu') 按需加载, 仅在运行时拉取, 不影响默认打包体积。
   */
  private async initWebGPURenderer() {
    if (this.opts.renderer === 'webgl') {
      this.backend = 'webgl';
      this.cb.onBackend?.('webgl');
      return;
    }
    try {
      if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
        throw new Error('WebGPU 不可用 (navigator.gpu 缺失)');
      }
      const mod = await import('three/webgpu');
      const r = new mod.WebGPURenderer({ antialias: true });
      await r.init();
      r.setPixelRatio(this.renderer.getPixelRatio());
      r.setSize(this.container.clientWidth || 800, this.container.clientHeight || 600);
      const old = this.renderer;
      if (old.domElement.parentNode === this.container) {
        this.container.replaceChild(r.domElement, old.domElement);
      }
      this.controls.dispose();
      old.dispose();
      this.renderer = r as unknown as AnyRenderer;
      this.nodeMatClass = mod.MeshStandardNodeMaterial;
      this.backend = 'webgpu';
      this.canvas = r.domElement;
      this.controls = new OrbitControls(this.camera, r.domElement);
      this.applyControlConstraints(this.controls);
      // 画布已热替换, 必须把指针监听迁移到新画布, 否则绘制/擦除点击失效
      this.attachPointerListeners(this.canvas);
      this.cb.onBackend?.('webgpu');
      // 若已配置 TSL, 现在切换为 NodeMaterial 以应用 TSL 节点
      if (this.tsl) this.rebuildMeshes();
    } catch (e) {
      this.backend = 'webgl';
      this.nodeMatClass = null;
      this.cb.onBackend?.('webgl');
      console.warn('[voxel-editor] WebGPU 不可用, 回退 WebGL2:', e);
    }
  }

  /** 动态设置/清除 TSL 描边/自发光增强 (null 关闭)。切换后端后也会重建材质以应用节点材质 */
  setTsl(opts: TslOptions | null) {
    this.tsl = opts;
    this.rebuildMeshes();
  }

  /**
   * 统一配置 OrbitControls 约束 (构造与 WebGPU 热替换两处共用):
   * - 禁用平移 -> 旋转中心 (target) 永远锁定在模型中心, 模型不会被拖出视野
   * - 限制俯仰角到地平线以上 -> 不能翻到模型正下方, 避免"转出去/翻转"的眩晕
   * - 降低旋转灵敏度 -> 一拖就甩出去的问题
   */
  private applyControlConstraints(c: OrbitControls) {
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.minDistance = 2;
    c.maxDistance = 2000;
    c.enablePan = false; // 锁定 target, 模型始终居中
    c.rotateSpeed = 0.5; // 更细腻的旋转手感
    c.minPolarAngle = 0.1; // 不完全正俯视, 避免万向锁
    c.maxPolarAngle = Math.PI / 2 - 0.05; // 不能转到模型下方
  }

  /** 把绘制/擦除的指针监听挂到指定画布 (构造 + WebGPU 热替换后都要调用) */
  private attachPointerListeners(canvas: HTMLCanvasElement) {
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup', this.onPointerUp);
  }

  private get grid(): VoxelGrid {
    return this.layers[this.activeLayer].grid;
  }

  private layerKey(layerId: number, ci: number): string {
    return `${layerId}:${ci}`;
  }

  // ---- 公共 API ----

  setMode(m: EditMode) {
    this.mode = m;
  }

  setColor(ci: number) {
    this.currentColor = ci;
  }

  setShowGrid(v: boolean) {
    this.showGrid = v;
    this.gridHelper.visible = v;
  }

  /** P4.6 对称笔刷: 设置某个轴的镜像开关 */
  setSymmetry(axis: 'x' | 'y' | 'z', on: boolean) {
    this.symmetry[axis] = on;
  }

  /** P4.6 对称笔刷: 切换某个轴的镜像开关, 返回切换后状态 */
  toggleSymmetry(axis: 'x' | 'y' | 'z'): boolean {
    this.symmetry[axis] = !this.symmetry[axis];
    return this.symmetry[axis];
  }

  /** P4.6 对称笔刷: 读取当前各轴镜像状态 */
  getSymmetry(): { x: boolean; y: boolean; z: boolean } {
    return { ...this.symmetry };
  }

  // ---- 图层 API (P4.6 余下: 非破坏式编辑) ----

  /** 当前图层列表的轻量信息 (供 UI 渲染) */
  getLayers(): LayerInfo[] {
    return this.layers.map((l, i) => ({
      id: l.id,
      name: l.name,
      visible: l.visible,
      opacity: l.opacity,
      count: l.grid.length,
      active: i === this.activeLayer,
    }));
  }

  /** 新增空白图层并设为激活层 */
  addLayer(name?: string) {
    const layer: EditorLayer = {
      id: this.nextLayerId++,
      name: name || `Layer ${this.layers.length + 1}`,
      visible: true,
      opacity: 1,
      grid: new VoxelGrid(this.defaultSize, this.defaultSize, this.defaultSize),
    };
    this.layers.push(layer);
    this.activeLayer = this.layers.length - 1;
    this.rebuildMeshes();
    this.emitStats();
    this.emitLayers();
  }

  /** 删除图层 (至少保留一个); 删除激活层时激活层回退到相邻层 */
  removeLayer(index: number) {
    if (this.layers.length <= 1) return; // 至少保留一个图层
    if (index < 0 || index >= this.layers.length) return;
    this.layers.splice(index, 1);
    if (this.activeLayer >= this.layers.length) this.activeLayer = this.layers.length - 1;
    else if (this.activeLayer > index) this.activeLayer--;
    this.rebuildMeshes();
    this.emitStats();
    this.emitLayers();
  }

  /** 上/下移动图层 (dir=-1 上移, +1 下移); 同时维护激活层索引 */
  moveLayer(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= this.layers.length) return;
    const wasActive = this.activeLayer;
    [this.layers[index], this.layers[j]] = [this.layers[j], this.layers[index]];
    // 维护激活层索引跟随被移动的层
    if (wasActive === index) this.activeLayer = j;
    else if (wasActive === j) this.activeLayer = index;
    this.rebuildMeshes();
    this.emitLayers();
  }

  setLayerVisible(index: number, visible: boolean) {
    const l = this.layers[index];
    if (!l) return;
    l.visible = visible;
    this.rebuildMeshes();
    this.emitStats();
    this.emitLayers();
  }

  /** 设置图层不透明度 (0..1); 0.999 以下视为半透明 -> 材质 transparent */
  setLayerOpacity(index: number, opacity: number) {
    const l = this.layers[index];
    if (!l) return;
    l.opacity = Math.max(0, Math.min(1, opacity));
    for (const ci of l.grid.voxels.values()) this.dirty.add(this.layerKey(l.id, ci));
    this.rebuildDirty();
    this.emitLayers();
  }

  setLayerName(index: number, name: string) {
    const l = this.layers[index];
    if (!l) return;
    l.name = name;
    this.emitLayers();
  }

  /** 设置激活图层 */
  setActiveLayer(index: number) {
    if (index < 0 || index >= this.layers.length) return;
    this.activeLayer = index;
    this.emitLayers();
  }

  /**
   * 布尔 CSG (P4.6 余下): 对当前激活图层与另一个体素网格执行 并/交/差。
   * @param op 'union'|'intersection'|'difference'
   * @param otherGrid 次操作数 (通常来自另一个 .vox 文件解析出的 VoxelGrid)
   */
  booleanOp(op: 'union' | 'intersection' | 'difference', otherGrid: VoxelGrid) {
    if (!(otherGrid instanceof VoxelGrid)) throw new TypeError('booleanOp: otherGrid 必须是 VoxelGrid');
    this.beginEdit();
    const result = voxelCSG(this.grid, otherGrid, op);
    this.layers[this.activeLayer].grid = result;
    this.rebuildMeshes();
    this.emitStats();
  }

  newModel(sx = this.defaultSize, sy = this.defaultSize, sz = this.defaultSize) {
    this.undoStack.clear();
    this.resetLayers(new VoxelGrid(sx, sy, sz));
    this.palette = defaultPalette();
    this.updateGroundAndGrid();
    this.rebuildMeshes();
    this.frameModel();
    this.emitStats();
    this.emitLayers();
    this.cb.onUndoChange?.(false);
  }

  clear() {
    if (this.grid.length === 0) return;
    this.beginEdit();
    this.grid.voxels.clear();
    this.rebuildMeshes();
    this.emitStats();
  }

  loadVox(buffer: ArrayBuffer | Uint8Array) {
    const { models, palette } = parseVox(buffer);
    if (!models.length) throw new Error('VOX 文件不包含任何模型');
    const m = models[0];
    this.undoStack.clear();
    const grid = new VoxelGrid(m.size[0], m.size[1], m.size[2]);
    for (const v of m.voxels) grid.voxels.set(keyOf(v.x, v.y, v.z), v.i);
    this.resetLayers(grid);
    this.palette = palette && palette.length === 256 ? palette : defaultPalette();
    this.updateGroundAndGrid();
    this.rebuildMeshes();
    this.frameModel();
    this.emitStats();
    this.emitLayers();
    this.cb.onUndoChange?.(false);
  }

  /** 载入一个彩色球体 demo, 便于首次打开即有内容可编辑 */
  loadDemo() {
    const s = this.defaultSize;
    this.undoStack.clear();
    const grid = new VoxelGrid(s, s, s);
    const r = 9;
    grid.addSphere(s / 2, s / 2, s / 2, r, (_dx, _dy, _dz, d) => {
      const t = d / r; // 0..1
      return 1 + Math.min(253, Math.floor(t * 253));
    });
    this.resetLayers(grid);
    this.palette = defaultPalette();
    this.updateGroundAndGrid();
    this.rebuildMeshes();
    this.frameModel();
    this.emitStats();
    this.emitLayers();
    this.cb.onUndoChange?.(false);
  }

  undo() {
    const snap = this.undoStack.pop();
    if (!snap) return;
    this.restore(snap);
    this.rebuildMeshes();
    this.emitStats();
    this.emitLayers();
    this.cb.onUndoChange?.(this.undoStack.canUndo);
  }

  toBytes(): Uint8Array {
    return toVoxBytes(this.getCompositeGrid(), this.palette);
  }

  exportVox(filename = 'model.vox') {
    downloadVox(this.getCompositeGrid(), filename, this.palette);
  }

  exportPng(filename = 'model.png') {
    this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  }

  /**
   * 把当前可见图层的合成体素模型导出为通用 3D 格式并触发浏览器下载。
   * 走 @voxel-tool/exporter: 纯数据 (体素 + 调色板) 喂给导出器, 由其构建 y-up 几何并调度各格式。
   * @param {VoxelFormat} format 'glb'|'gltf'|'obj'|'stl'|'ply'|'usdz'|'fbx'
   * @param {string} [filename] 文件名主体 (不含扩展名); 默认 'model'
   */
  async exportModel(format: VoxelFormat, filename = 'model') {
    const grid = this.getCompositeGrid();
    const exporter = new VoxelExporter({
      model: { size: [grid.sx, grid.sy, grid.sz], voxels: grid.list() },
      palette: this.palette,
    });
    await exporter.download(format, { filename: `${filename}.${format}` });
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    this.resizeObserver.disconnect();
    const canvas = this.canvas ?? this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('pointerup', this.onPointerUp);
    this.controls.dispose();
    this.materialCache.forEach((m) => m.dispose());
    this.disposeInstances();
    SHARED_BOX.dispose();
    this.renderer.dispose();
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }

  // ---- 内部实现 ----

  private disposed = false;

  private resetLayers(grid: VoxelGrid) {
    this.layers = [{ id: 0, name: 'Layer 1', visible: true, opacity: 1, grid }];
    this.activeLayer = 0;
    this.nextLayerId = 1;
  }

  /** 把可见图层从上到下合并为非破坏式合成结果 (后面的图层覆盖前面) */
  private getCompositeGrid(): VoxelGrid {
    let sx = 0, sy = 0, sz = 0;
    for (const l of this.layers) {
      if (!l.visible) continue;
      sx = Math.max(sx, l.grid.sx);
      sy = Math.max(sy, l.grid.sy);
      sz = Math.max(sz, l.grid.sz);
    }
    const g = new VoxelGrid(sx || this.defaultSize, sy || this.defaultSize, sz || this.defaultSize);
    for (const l of this.layers) {
      if (!l.visible) continue;
      for (const [k, ci] of l.grid.voxels) g.voxels.set(k, ci); // 后者覆盖前者
    }
    return g;
  }

  private getMaterial(layerId: number, ci: number): THREE.MeshStandardMaterial {
    const key = this.layerKey(layerId, ci);
    let mat = this.materialCache.get(key);
    const layer = this.layers.find((l) => l.id === layerId);
    const op = layer ? layer.opacity : 1;
    if (!mat) {
      const col = this.palette[ci] || [200, 200, 200, 255];
      const color = new THREE.Color(col[0] / 255, col[1] / 255, col[2] / 255);
      let m: THREE.MeshStandardMaterial;
      if (this.tsl && this.backend === 'webgpu' && this.nodeMatClass) {
        // WebGPU + TSL: 用 NodeMaterial 挂 TSL 描边/自发光节点
        m = new this.nodeMatClass({ color, metalness: 0, roughness: 0.9, transparent: op < 1, opacity: op });
        applyVoxelTsl(m, this.tsl);
      } else {
        m = new THREE.MeshStandardMaterial({ color, metalness: 0, roughness: 0.9, transparent: op < 1, opacity: op });
        // WebGL 回退路径: TSL 描边不可用, 仅自发光可降级为经典属性
        if (this.tsl && this.tsl.emissive) {
          m.emissive = new THREE.Color(this.tsl.emissive[0], this.tsl.emissive[1], this.tsl.emissive[2]);
          m.emissiveIntensity = this.tsl.emissiveIntensity ?? 1;
        }
      }
      mat = m;
      this.materialCache.set(key, mat);
    } else {
      // 透明度可能随图层设置变化, 每次取用时同步 (缓存按 layerId:ci, 不会跨图层串味)
      mat.opacity = op;
      mat.transparent = op < 1;
    }
    return mat;
  }

  private updateGroundAndGrid() {
    const g = this.getCompositeGrid();
    this.groundPlane.scale.set(g.sx, g.sz, 1);
    this.groundPlane.position.set(g.sx / 2, -0.5, g.sz / 2);

    const span = Math.max(g.sx, g.sz);
    this.gridHelper.scale.set(span, 1, span);
    this.gridHelper.position.set(g.sx / 2, -0.5, g.sz / 2);
  }

  private rebuildMeshes() {
    // 全量重建: 先清掉旧模型的残留颜色组, 再标脏所有可见图层的颜色组重建 (保留地面与参考网格)
    this.disposeInstances();
    this.updateGroundAndGrid();
    for (const l of this.layers) {
      if (!l.visible) continue;
      for (const ci of l.grid.voxels.values()) this.dirty.add(this.layerKey(l.id, ci));
    }
    this.rebuildDirty();
  }

  /** 释放所有 InstancedMesh 与其几何/材质引用 (保留 SHARED_BOX 单例) */
  private disposeInstances() {
    for (const { mesh } of this.instanceGroups.values()) {
      this.voxelsGroup.remove(mesh);
      mesh.dispose(); // 释放实例矩阵 buffer (几何 SHARED_BOX/材质为共享, 不在此释放)
    }
    this.instanceGroups.clear();
    this.dirty.clear();
    this.materialCache.clear();
  }

  /** 重建所有被标脏组 (由 rebuildMeshes / 增量编辑 / 透明度变更触发) */
  private rebuildDirty() {
    for (const key of this.dirty) {
      const sep = key.lastIndexOf(':');
      const layerId = Number(key.slice(0, sep));
      const ci = Number(key.slice(sep + 1));
      this.rebuildInstanceGroup(layerId, ci);
    }
    this.dirty.clear();
  }

  /** 按 (图层id, 颜色ci) 重建一个 InstancedMesh: 收集该色全部体素, 写入实例矩阵与坐标映射 */
  private rebuildInstanceGroup(layerId: number, ci: number) {
    const key = this.layerKey(layerId, ci);
    const old = this.instanceGroups.get(key);
    if (old) {
      this.voxelsGroup.remove(old.mesh);
      old.mesh.dispose();
      this.instanceGroups.delete(key);
    }
    const layer = this.layers.find((l) => l.id === layerId);
    if (!layer || !layer.visible) return; // 图层隐藏: 不渲染其组

    const voxels: { x: number; y: number; z: number }[] = [];
    for (const [k, c] of layer.grid.voxels) {
      if (c !== ci) continue;
      const [x, y, z] = k.split(',').map(Number);
      voxels.push({ x, y, z });
    }
    if (voxels.length === 0) return; // 该色无体素, 组已移除

    const mesh = new THREE.InstancedMesh(SHARED_BOX, this.getMaterial(layerId, ci), voxels.length);
    mesh.frustumCulled = false; // 共享几何包围盒为单格, 由 group 变换后整体剔除不如关闭稳妥
    const coordMap = new Map<number, string>();
    const m = new THREE.Matrix4();
    for (let i = 0; i < voxels.length; i++) {
      const { x, y, z } = voxels[i];
      m.makeTranslation(x + 0.5, y + 0.5, z + 0.5);
      mesh.setMatrixAt(i, m);
      coordMap.set(i, keyOf(x, y, z));
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.userData = { isVoxel: true, layerId, ci };
    this.voxelsGroup.add(mesh);
    this.instanceGroups.set(key, { mesh, coordMap, layerId, ci });
  }

  private addVoxel(x: number, y: number, z: number, ci: number) {
    if (x < 0 || y < 0 || z < 0 || x >= this.grid.sx || y >= this.grid.sy || z >= this.grid.sz) return;
    const k = keyOf(x, y, z);
    if (this.grid.voxels.has(k)) return;
    this.grid.voxels.set(k, ci);
    this.dirty.add(this.layerKey(this.layers[this.activeLayer].id, ci)); // 标脏该色; 实际重建由调用方在编辑批次结束后统一触发
  }

  private removeVoxel(x: number, y: number, z: number) {
    const k = keyOf(x, y, z);
    const ci = this.grid.voxels.get(k);
    if (ci === undefined) return;
    this.grid.voxels.delete(k);
    this.dirty.add(this.layerKey(this.layers[this.activeLayer].id, ci)); // 标脏该色; 实际重建由调用方统一触发
  }

  /**
   * P4.6 对称笔刷: 把一次编辑坐标 (x,y,z) 按当前 symmetry 展开为所有镜像坐标,
   * 对每个坐标调用 fn (fn 通常是 addVoxel / removeVoxel)。 镜像坐标可能越界,
   * 由 addVoxel 的边界检查静默丢弃, 因此这里无需额外裁剪.
   */
  private applySymmetry(x: number, y: number, z: number, fn: (x: number, y: number, z: number) => void) {
    const coords = mirrorCoordinates(x, y, z, [this.grid.sx, this.grid.sy, this.grid.sz], this.symmetry);
    for (const [X, Y, Z] of coords) fn(X, Y, Z);
  }

  private beginEdit() {
    this.undoStack.push(this.snapshot());
    this.cb.onUndoChange?.(this.undoStack.canUndo);
  }

  /** 全图层快照 (含尺寸/可见/透明度), 撤销时整体还原 —— 非破坏式编辑的基础 */
  private snapshot(): string {
    return JSON.stringify(
      this.layers.map((l) => ({
        id: l.id,
        name: l.name,
        visible: l.visible,
        opacity: l.opacity,
        size: [l.grid.sx, l.grid.sy, l.grid.sz],
        voxels: l.grid.list(),
      })),
    );
  }

  private restore(snap: string) {
    const arr = JSON.parse(snap) as {
      id: number; name: string; visible: boolean; opacity: number;
      size: [number, number, number]; voxels: { x: number; y: number; z: number; i: number }[];
    }[];
    this.layers = arr.map((l) => {
      const g = new VoxelGrid(l.size[0], l.size[1], l.size[2]);
      for (const v of l.voxels) g.voxels.set(keyOf(v.x, v.y, v.z), v.i);
      return { id: l.id, name: l.name, visible: l.visible, opacity: l.opacity, grid: g };
    });
    if (this.activeLayer > this.layers.length - 1) this.activeLayer = this.layers.length - 1;
  }

  private emitStats() {
    const count = this.layers.reduce((s, l) => s + (l.visible ? l.grid.length : 0), 0);
    const g = this.getCompositeGrid();
    this.cb.onStats?.({ count, size: [g.sx, g.sy, g.sz] });
  }

  private emitLayers() {
    this.cb.onLayersChange?.(this.getLayers());
  }

  private frameModel() {
    const box = new THREE.Box3();
    if (this.instanceGroups.size === 0) {
      // 空模型: 以网格中心为参考
      const g = this.getCompositeGrid();
      box.setFromCenterAndSize(
        new THREE.Vector3(g.sx / 2, g.sz / 2, -g.sy / 2),
        new THREE.Vector3(g.sx, g.sz, g.sy),
      );
    } else {
      for (const { mesh } of this.instanceGroups.values()) box.expandByObject(mesh);
    }
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 1);
    const dist = maxDim * 1.8;
    this.controls.target.copy(center);
    this.camera.position.set(center.x + dist, center.y + dist * 0.8, center.z + dist);
    this.camera.near = maxDim / 200;
    this.camera.far = maxDim * 200;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  private onPointerDown = (e: PointerEvent) => {
    this.downPos.set(e.clientX, e.clientY);
    this.downTime = performance.now();
  };

  private onPointerUp = (e: PointerEvent) => {
    const moved = Math.hypot(e.clientX - this.downPos.x, e.clientY - this.downPos.y);
    const dt = performance.now() - this.downTime;
    if (moved > 5 || dt > 600) return; // 视为拖拽(旋转视角), 不绘制

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const targets = [this.groundPlane, ...[...this.instanceGroups.values()].map((g) => g.mesh)];
    const hits = this.raycaster.intersectObjects(targets, false);
    if (!hits.length) return;
    const hit = hits[0];
    const ud = hit.object.userData as {
      isVoxel?: boolean; isGround?: boolean; x?: number; y?: number; z?: number; ci?: number; layerId?: number;
    };

    // 取色 (Shift / Alt + 点击)
    if ((e.altKey || e.shiftKey) && ud.isVoxel) {
      const ci = ud.ci as number;
      this.currentColor = ci;
      this.cb.onColorPicked?.(ci);
      return;
    }

    const wasEmpty = this.instanceGroups.size === 0;
    this.beginEdit();

    if (ud.isGround) {
      if (this.mode === 'erase') {
        this.undoStack.pop();
        return;
      }
      const lp = this.voxelsGroup.worldToLocal(hit.point.clone());
      const x = Math.floor(lp.x);
      const z = Math.floor(lp.z);
      // P4.6: 对称笔刷——一次落点展开为所有镜像坐标 (作用于激活图层)
      this.applySymmetry(x, 0, z, (X, Y, Z) => this.addVoxel(X, Y, Z, this.currentColor));
    } else if (ud.isVoxel) {
      // 由 instanceId 反查体素坐标 (InstancedMesh 拾取需 instanceId, 非 userData.x/y/z)
      const lid = ud.layerId as number;
      const coordKey = hit.instanceId !== undefined
        ? (this.instanceGroups.get(this.layerKey(lid, ud.ci as number))?.coordMap.get(hit.instanceId) ?? '')
        : '';
      const parts = coordKey ? coordKey.split(',').map(Number) : [ud.x ?? 0, ud.y ?? 0, ud.z ?? 0];
      const [x, y, z] = parts as [number, number, number];
      if (this.mode === 'erase') {
        this.applySymmetry(x, y, z, (X, Y, Z) => this.removeVoxel(X, Y, Z));
      } else {
        const n = hit.face ? hit.face.normal : new THREE.Vector3(0, 1, 0);
        this.applySymmetry(x + n.x, y + n.y, z + n.z, (X, Y, Z) => this.addVoxel(X, Y, Z, this.currentColor));
      }
    }
    // 一次笔触可能产生多个体素(对称/多图层), 统一重建一次受脏组, 比逐个重建更高效
    this.rebuildDirty();
    if (wasEmpty) this.frameModel();
    this.emitStats();
  };

  private onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private animate = () => {
    if (this.disposed) return;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.rafId = requestAnimationFrame(this.animate);
  };
}
