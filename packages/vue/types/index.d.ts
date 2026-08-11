import type { DefineComponent } from 'vue';

/**
 * Props for the {@link VoxViewer} Vue component.
 * Size is given as `[width, height]`, both defaulting to 480 when omitted.
 */
export interface VoxViewerProps {
  /** Raw MagicaVoxel .vox bytes. */
  src?: ArrayBuffer | Uint8Array;
  /** A pre-parsed model ({@link parseVox} result's `models[0]`). */
  model?: { size: [number, number, number]; voxels: { x: number; y: number; z: number; i: number }[] };
  /** 256-entry RGBA palette, each entry `[r, g, b, a]`. */
  palette?: number[][];
  /** Canvas background color, defaults to `#16181e`. */
  background?: string;
  /** Canvas `[width, height]` in px, defaults to `[480, 480]`. */
  size?: [number, number];
}

/** Vue 3 3D viewer component for MagicaVoxel .vox models. */
export const VoxViewer: DefineComponent<VoxViewerProps>;

export { buildVoxelGeometry, createVoxelViewer } from '@voxel-tool/viewer';
