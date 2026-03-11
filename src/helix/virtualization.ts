export interface VirtualListConfig {
  itemHeight: number;
  bufferSize?: number;
  containerSelector: string;
}

export interface VirtualGridConfig {
  itemWidth: number;
  itemHeight: number;
  columnCount: number;
  bufferSize?: number;
  containerSelector: string;
}

export interface WindowState {
  startIndex: number;
  endIndex: number;
  visibleCount: number;
  offsetTop: number;
  totalCount: number;
}

export class VirtualList {
  private config: Required<VirtualListConfig>;
  private container: HTMLElement | null = null;
  private state: WindowState;
  private scrollListener: () => void;

  constructor(config: VirtualListConfig) {
    this.config = {
      ...config,
      bufferSize: config.bufferSize ?? 5
    };
    this.state = {
      startIndex: 0,
      endIndex: 0,
      visibleCount: 0,
      offsetTop: 0,
      totalCount: 0
    };
    this.scrollListener = () => this.updateWindow();
  }

  attach(): void {
    this.container = document.querySelector<HTMLElement>(this.config.containerSelector);
    if (!this.container) {
      throw new Error(`Virtual list container not found: ${this.config.containerSelector}`);
    }
    this.container.addEventListener("scroll", this.scrollListener);
    this.updateWindow();
  }

  detach(): void {
    if (this.container) {
      this.container.removeEventListener("scroll", this.scrollListener);
    }
  }

  private updateWindow(): void {
    if (!this.container) return;

    const scrollTop = this.container.scrollTop;
    const containerHeight = this.container.clientHeight;
    const visibleCount = Math.ceil(containerHeight / this.config.itemHeight) + this.config.bufferSize * 2;

    const startIndex = Math.max(0, Math.floor(scrollTop / this.config.itemHeight) - this.config.bufferSize);
    const endIndex = startIndex + visibleCount;

    this.state = {
      startIndex,
      endIndex,
      visibleCount,
      offsetTop: startIndex * this.config.itemHeight,
      totalCount: this.state.totalCount
    };
  }

  getWindow(): WindowState {
    return { ...this.state };
  }

  setTotalCount(count: number): void {
    this.state.totalCount = count;
    this.updateWindow();
  }

  getVisibleKeys<T>(allKeys: readonly T[]): T[] {
    return allKeys.slice(this.state.startIndex, this.state.endIndex);
  }
}

export class VirtualGrid {
  private config: Required<VirtualGridConfig>;
  private container: HTMLElement | null = null;
  private state: WindowState;
  private scrollListener: () => void;

  constructor(config: VirtualGridConfig) {
    this.config = {
      ...config,
      bufferSize: config.bufferSize ?? 5
    };
    this.state = {
      startIndex: 0,
      endIndex: 0,
      visibleCount: 0,
      offsetTop: 0,
      totalCount: 0
    };
    this.scrollListener = () => this.updateWindow();
  }

  attach(): void {
    this.container = document.querySelector<HTMLElement>(this.config.containerSelector);
    if (!this.container) {
      throw new Error(`Virtual grid container not found: ${this.config.containerSelector}`);
    }
    this.container.addEventListener("scroll", this.scrollListener);
    this.updateWindow();
  }

  detach(): void {
    if (this.container) {
      this.container.removeEventListener("scroll", this.scrollListener);
    }
  }

  private updateWindow(): void {
    if (!this.container) return;

    const scrollTop = this.container.scrollTop;
    const containerHeight = this.container.clientHeight;
    const rowHeight = this.config.itemHeight;
    const visibleRows = Math.ceil(containerHeight / rowHeight) + this.config.bufferSize * 2;
    const visibleCount = visibleRows * this.config.columnCount;

    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) * this.config.columnCount - this.config.bufferSize * this.config.columnCount);
    const endIndex = startIndex + visibleCount;

    this.state = {
      startIndex,
      endIndex,
      visibleCount,
      offsetTop: Math.floor(startIndex / this.config.columnCount) * rowHeight,
      totalCount: this.state.totalCount
    };
  }

  getWindow(): WindowState {
    return { ...this.state };
  }

  setTotalCount(count: number): void {
    this.state.totalCount = count;
    this.updateWindow();
  }

  getVisibleKeys<T>(allKeys: readonly T[]): T[] {
    return allKeys.slice(this.state.startIndex, this.state.endIndex);
  }
}
