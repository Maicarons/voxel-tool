/// <reference types="vite/client" />

// 为 @voxel-tool/core (纯 JS, 无 TS 类型) 提供最小类型声明
declare module '@voxel-tool/core' {
  export class VoxelGrid {
    sx: number;
    sy: number;
    sz: number;
    voxels: Map<string, number>;
    constructor(sx: number, sy: number, sz: number);
    set(x: number, y: number, z: number, ci: number): void;
    addSphere(
      cx: number,
      cy: number,
      cz: number,
      r: number,
      ciFn: (dx: number, dy: number, dz: number, d: number) => number
    ): void;
    get length(): number;
    list(): { x: number; y: number; z: number; i: number }[];
  }
  export function parseVox(
    input: ArrayBuffer | Uint8Array
  ): {
    version: number;
    models: { size: [number, number, number]; voxels: { x: number; y: number; z: number; i: number }[] }[];
    palette: number[][] | null;
  };
  export function toVoxBytes(grid: VoxelGrid, palette?: number[][] | null): Uint8Array;
  export function downloadVox(grid: VoxelGrid, filename?: string, palette?: number[][] | null): void;
  export function defaultPalette(): number[][];
  export const MAGIC: Uint8Array;
  export const VERSION: number;
}
