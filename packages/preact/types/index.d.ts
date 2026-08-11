import type { ComponentType } from 'preact';

/**
 * Props for the {@link VoxViewer} Preact component.
 * `width`/`height` default to 480 when omitted.
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
  /** Canvas width in px, defaults to 480. */
  width?: number;
  /** Canvas height in px, defaults to 480. */
  height?: number;
}

/** Preact 3D viewer component for MagicaVoxel .vox models. */
export const VoxViewer: ComponentType<VoxViewerProps>;

export { buildVoxelGeometry, createVoxelViewer } from '@voxel-tool/viewer';
