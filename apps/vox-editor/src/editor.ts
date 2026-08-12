import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  VoxelGrid,
  parseVox,
  toVoxBytes,
  downloadVox,
  defaultPalette,
} from '@voxel-tool/core';
import { VoxelExporter } from '@voxel-tool/exporter';
import type { VoxelFormat } from '@voxel-tool/exporter';
import { EditorUndoStack } from './undo';

// 重新导出供 UI 层 (Toolbar / App) 引用, 避免重复 import 第三方包
export type { VoxelFormat } from '@voxel-tool/exporter';

export type EditMode = 'paint' | 'erase';

export interface EditorStats {
  count: number;
  size: [number, number, number];
}

export interface EditorCallbacks {
  onStats?: (s: EditorStats) => void;
  onColorPicked?: (ci: number) => void;
  onUndoChange?: (canUndo: boolean) => void;
}

const SHARED_BOX = new THREE.BoxGeometry(1, 1, 1);
const keyOf = (x: number, y: number, z: number) => `${x},${y},${z}`;

/**
 * 框架无关的体素编辑器引擎 (基于 Three.js)。
 * - 体素模型保存在 VoxelGrid (来自 @voxel-tool/core)
 * - 每个体素是一个 BoxGeometry mesh, 用 face normal 推算相邻空格, 支持点击绘制/擦除
 * - z-up (MagicaVoxel 坐标系) 通过 voxelsGroup.rotation.x = -90° 转为 three 的 y-up
 */
export class VoxelEditor {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private voxelsGroup: THREE.Group;
  private groundPlane: THREE.Mesh;
  private gridHelper: THREE.GridHelper;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private materialCache = new Map<number, THREE.MeshLambertMaterial>();
  private meshMap = new Map<string, THREE.Mesh>();
  private grid: VoxelGrid;
  private palette: number[][];
  private mode: EditMode = 'paint';
  private currentColor = 1;
  private showGrid = true;
  private undoStack = new EditorUndoStack();
  private cb: EditorCallbacks;
  private resizeObserver: ResizeObserver;
  private rafId = 0;
  private downPos = new THREE.Vector2();
  private downTime = 0;
  private defaultSize = 24;

  constructor(container: HTMLElement, cb: EditorCallbacks = {}) {
    this.container = container;
    this.cb = cb;
    this.palette = defaultPalette();
    this.grid = new VoxelGrid(this.defaultSize, this.defaultSize, this.defaultSize);

    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x16161a);

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 5000);
    this.camera.position.set(30, 30, 30);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.touchAction = 'none';
    container.appendChild(canvas);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 2000;

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

  newModel(sx = this.defaultSize, sy = this.defaultSize, sz = this.defaultSize) {
    this.undoStack.clear();
    this.grid = new VoxelGrid(sx, sy, sz);
    this.palette = defaultPalette();
    this.updateGroundAndGrid();
    this.rebuildMeshes();
    this.frameModel();
    this.emitStats();
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
    this.grid = new VoxelGrid(m.size[0], m.size[1], m.size[2]);
    for (const v of m.voxels) {
      this.grid.voxels.set(keyOf(v.x, v.y, v.z), v.i);
    }
    this.palette = palette && palette.length === 256 ? palette : defaultPalette();
    this.updateGroundAndGrid();
    this.rebuildMeshes();
    this.frameModel();
    this.emitStats();
    this.cb.onUndoChange?.(false);
  }

  /** 载入一个彩色球体 demo, 便于首次打开即有内容可编辑 */
  loadDemo() {
    const s = this.defaultSize;
    this.undoStack.clear();
    this.grid = new VoxelGrid(s, s, s);
    this.palette = defaultPalette();
    const r = 9;
    this.grid.addSphere(s / 2, s / 2, s / 2, r, (_dx, _dy, _dz, d) => {
      const t = d / r; // 0..1
      return 1 + Math.min(253, Math.floor(t * 253));
    });
    this.updateGroundAndGrid();
    this.rebuildMeshes();
    this.frameModel();
    this.emitStats();
    this.cb.onUndoChange?.(false);
  }

  undo() {
    const snap = this.undoStack.pop();
    if (!snap) return;
    const list = JSON.parse(snap) as { x: number; y: number; z: number; i: number }[];
    this.grid.voxels.clear();
    for (const v of list) this.grid.voxels.set(keyOf(v.x, v.y, v.z), v.i);
    this.rebuildMeshes();
    this.emitStats();
    this.cb.onUndoChange?.(this.undoStack.canUndo);
  }

  toBytes(): Uint8Array {
    return toVoxBytes(this.grid, this.palette);
  }

  exportVox(filename = 'model.vox') {
    downloadVox(this.grid, filename, this.palette);
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
   * 把当前体素模型导出为通用 3D 格式并触发浏览器下载。
   * 走 @voxel-tool/exporter: 纯数据 (体素 + 调色板) 喂给导出器, 由其构建 y-up 几何并调度各格式。
   * @param {VoxelFormat} format 'glb'|'gltf'|'obj'|'stl'|'ply'|'usdz'|'fbx'
   * @param {string} [filename] 文件名主体 (不含扩展名); 默认 'model'
   */
  async exportModel(format: VoxelFormat, filename = 'model') {
    const exporter = new VoxelExporter({
      model: { size: [this.grid.sx, this.grid.sy, this.grid.sz], voxels: this.grid.list() },
      palette: this.palette,
    });
    await exporter.download(format, { filename: `${filename}.${format}` });
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    this.resizeObserver.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('pointerup', this.onPointerUp);
    this.controls.dispose();
    this.materialCache.forEach((m) => m.dispose());
    SHARED_BOX.dispose();
    this.renderer.dispose();
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }

  // ---- 内部实现 ----

  private disposed = false;

  private getMaterial(ci: number): THREE.MeshLambertMaterial {
    let mat = this.materialCache.get(ci);
    if (!mat) {
      const col = this.palette[ci] || [200, 200, 200, 255];
      mat = new THREE.MeshLambertMaterial({
        color: new THREE.Color(col[0] / 255, col[1] / 255, col[2] / 255),
      });
      this.materialCache.set(ci, mat);
    }
    return mat;
  }

  private updateGroundAndGrid() {
    const { sx, sy, sz } = this.grid;
    this.groundPlane.scale.set(sx, sz, 1);
    this.groundPlane.position.set(sx / 2, -0.5, sz / 2);

    const span = Math.max(sx, sz);
    this.gridHelper.scale.set(span, 1, span);
    this.gridHelper.position.set(sx / 2, -0.5, sz / 2);
  }

  private rebuildMeshes() {
    // 仅移除体素 mesh, 保留地面与参考网格
    for (const mesh of this.meshMap.values()) {
      this.voxelsGroup.remove(mesh);
    }
    this.meshMap.clear();
    for (const [k, ci] of this.grid.voxels) {
      const [x, y, z] = k.split(',').map(Number);
      this.addVoxelMesh(x, y, z, ci);
    }
  }

  private addVoxelMesh(x: number, y: number, z: number, ci: number) {
    const mesh = new THREE.Mesh(SHARED_BOX, this.getMaterial(ci));
    mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    mesh.userData = { isVoxel: true, x, y, z, ci };
    this.voxelsGroup.add(mesh);
    this.meshMap.set(keyOf(x, y, z), mesh);
  }

  private addVoxel(x: number, y: number, z: number, ci: number) {
    if (x < 0 || y < 0 || z < 0 || x >= this.grid.sx || y >= this.grid.sy || z >= this.grid.sz) return;
    const k = keyOf(x, y, z);
    if (this.grid.voxels.has(k)) return;
    this.grid.voxels.set(k, ci);
    this.addVoxelMesh(x, y, z, ci);
  }

  private removeVoxel(x: number, y: number, z: number) {
    const k = keyOf(x, y, z);
    const mesh = this.meshMap.get(k);
    if (!mesh) return;
    this.grid.voxels.delete(k);
    this.voxelsGroup.remove(mesh);
    this.meshMap.delete(k);
  }

  private beginEdit() {
    this.undoStack.push(JSON.stringify(this.grid.list()));
    this.cb.onUndoChange?.(this.undoStack.canUndo);
  }

  private emitStats() {
    this.cb.onStats?.({ count: this.grid.length, size: [this.grid.sx, this.grid.sy, this.grid.sz] });
  }

  private frameModel() {
    const box = new THREE.Box3();
    if (this.meshMap.size === 0) {
      // 空模型: 以网格中心为参考
      box.setFromCenterAndSize(
        new THREE.Vector3(this.grid.sx / 2, this.grid.sz / 2, -this.grid.sy / 2),
        new THREE.Vector3(this.grid.sx, this.grid.sz, this.grid.sy)
      );
    } else {
      for (const m of this.meshMap.values()) box.expandByObject(m);
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

    const targets = [this.groundPlane, ...this.meshMap.values()];
    const hits = this.raycaster.intersectObjects(targets, false);
    if (!hits.length) return;
    const hit = hits[0];
    const ud = hit.object.userData as { isVoxel?: boolean; isGround?: boolean; x?: number; y?: number; z?: number; ci?: number };

    // 取色 (Shift / Alt + 点击)
    if ((e.altKey || e.shiftKey) && ud.isVoxel) {
      const ci = ud.ci as number;
      this.currentColor = ci;
      this.cb.onColorPicked?.(ci);
      return;
    }

    const wasEmpty = this.meshMap.size === 0;
    this.beginEdit();

    if (ud.isGround) {
      if (this.mode === 'erase') {
        this.undoStack.pop();
        return;
      }
      const lp = this.voxelsGroup.worldToLocal(hit.point.clone());
      const x = Math.floor(lp.x);
      const z = Math.floor(lp.z);
      this.addVoxel(x, 0, z, this.currentColor);
      if (wasEmpty) this.frameModel();
    } else if (ud.isVoxel) {
      const x = ud.x as number;
      const y = ud.y as number;
      const z = ud.z as number;
      if (this.mode === 'erase') {
        this.removeVoxel(x, y, z);
      } else {
        const n = hit.face ? hit.face.normal : new THREE.Vector3(0, 1, 0);
        this.addVoxel(x + n.x, y + n.y, z + n.z, this.currentColor);
      }
    }
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
