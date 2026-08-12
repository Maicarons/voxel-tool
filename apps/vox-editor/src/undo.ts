// 编辑器撤销栈: 体素网格的快照历史 (纯数据, 与渲染无关).
// 每次编辑前 push 当前网格的 JSON 快照; undo 时弹栈并恢复. 上限 100 步防止无限增长.
//
// 从 editor.ts 抽离 (P2 解耦): 撤销历史是独立关注点, 不依赖 Three.js / DOM, 可单独测试.

export class EditorUndoStack {
  private stack: string[] = [];
  private readonly maxSize = 100;

  /** 清空历史 (新建 / 载入模型时调用) */
  clear(): void {
    this.stack.length = 0;
  }

  /** 当前是否可撤销 */
  get canUndo(): boolean {
    return this.stack.length > 0;
  }

  /** 当前历史步数 */
  get size(): number {
    return this.stack.length;
  }

  /** 压入一帧快照 (超过上限时丢弃最早一帧) */
  push(snapshot: string): void {
    this.stack.push(snapshot);
    if (this.stack.length > this.maxSize) this.stack.shift();
  }

  /** 弹出最近一帧快照; 空栈返回 undefined */
  pop(): string | undefined {
    return this.stack.pop();
  }
}
