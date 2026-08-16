/**
 * A frame-sequence player: paints one image of a sequence onto a canvas, with
 * the frame number chosen by a caller-supplied progress value.
 *
 * Deliberately free of GSAP — the scroll wiring lives in the component, and
 * this stays a plain player that could be driven by anything. Three concerns:
 * preloading (sparse pass, then the rest), cover-fitting the draw, and
 * throttling paints to one per animation frame.
 */

const MAX_CONCURRENCY = 8;

type Frame = ImageBitmap | HTMLImageElement;

type Options = {
  canvas: HTMLCanvasElement;
  frameCount: number;
  /** 1-based frame number → URL. */
  src: (index: number) => string;
  /** Stride of the first pass; every Nth frame is fetched before releasing. */
  warmupStep?: number;
  onProgress?: (loaded: number, total: number) => void;
};

export class ScrollVideo {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly frameCount: number;
  private readonly src: (index: number) => string;
  private readonly warmupStep: number;
  private readonly onProgress?: (loaded: number, total: number) => void;

  /** Index 0 holds frame 1. Sparse until the second pass lands. */
  private frames: (Frame | undefined)[];
  private loadedCount = 0;
  private currentFrame = -1;
  private targetFrame = 0;
  private rafId = 0;
  private destroyed = false;

  constructor({ canvas, frameCount, src, warmupStep = 10, onProgress }: Options) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.frameCount = frameCount;
    this.src = src;
    this.warmupStep = warmupStep;
    this.onProgress = onProgress;
    this.frames = Array.from({ length: frameCount });

    this.resize();
    window.addEventListener("resize", this.handleResize, { passive: true });
    window.addEventListener("orientationchange", this.handleResize, {
      passive: true,
    });
  }

  /* ---- loading -------------------------------------------------------- */

  /**
   * First pass grabs every `warmupStep`th frame and resolves — enough to
   * scroll through the whole sequence, with gaps. Second pass fills in the
   * rest in the background and never blocks.
   */
  async load(): Promise<void> {
    const all = Array.from({ length: this.frameCount }, (_, i) => i);
    const warmup = all.filter(
      (i) => i % this.warmupStep === 0 || i === this.frameCount - 1
    );
    const warmupSet = new Set(warmup);
    const rest = all.filter((i) => !warmupSet.has(i));

    await this.loadBatch(warmup);
    // First frame is in — paint it rather than leaving the reader on black.
    this.draw(0);

    void this.loadBatch(rest).then(() => {
      if (!this.destroyed) this.draw(this.currentFrame, true);
    });
  }

  private async loadBatch(indices: number[]): Promise<void> {
    let cursor = 0;
    const workers = Array.from(
      { length: Math.min(MAX_CONCURRENCY, indices.length) },
      async () => {
        while (cursor < indices.length && !this.destroyed) {
          const index = indices[cursor++];
          try {
            this.frames[index] = await this.loadFrame(index);
          } catch {
            // One missing frame is survivable: the draw path falls back to
            // the nearest loaded neighbour.
          }
          this.loadedCount++;
          this.onProgress?.(this.loadedCount, this.frameCount);
        }
      }
    );
    await Promise.all(workers);
  }

  /** ImageBitmap first — it decodes off the main thread and draws faster. */
  private async loadFrame(index: number): Promise<Frame> {
    const url = this.src(index + 1);
    if ("createImageBitmap" in window) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await createImageBitmap(await res.blob());
    }
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`load failed: ${url}`));
      img.src = url;
    });
  }

  /** Nearest already-loaded frame, so a gap never flashes blank. */
  private nearestLoaded(index: number): number {
    if (this.frames[index]) return index;
    for (let offset = 1; offset < this.frameCount; offset++) {
      if (this.frames[index - offset]) return index - offset;
      if (this.frames[index + offset]) return index + offset;
    }
    return -1;
  }

  /* ---- painting ------------------------------------------------------- */

  /** Backing store follows CSS size × DPR, capped at 2 — past that is just
   *  burnt VRAM. Returns whether the size actually changed. */
  resize(): boolean {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const nextW = Math.round(this.canvas.clientWidth * dpr);
    const nextH = Math.round(this.canvas.clientHeight * dpr);
    if (nextW === 0 || nextH === 0) return false;
    if (this.canvas.width === nextW && this.canvas.height === nextH) return false;
    this.canvas.width = nextW;
    this.canvas.height = nextH;
    return true;
  }

  private handleResize = () => {
    if (this.resize()) this.draw(this.currentFrame, true);
  };

  /** Cover-fit the frame. Canvas has no `object-fit`, so the maths is here. */
  draw(index: number, force = false): void {
    if (!this.ctx) return;
    if (index < 0 || (index === this.currentFrame && !force)) return;
    const usable = this.nearestLoaded(index);
    if (usable < 0) return;

    const frame = this.frames[usable];
    if (!frame) return;

    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const scale = Math.max(cw / frame.width, ch / frame.height);
    const dw = frame.width * scale;
    const dh = frame.height * scale;

    this.ctx.drawImage(frame, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    this.currentFrame = index;
  }

  /**
   * Scroll callbacks only record a target; the actual `drawImage` is merged
   * into the next animation frame, so a burst of scroll events still paints
   * at most once per refresh.
   */
  seek(progress: number): void {
    const clamped = progress < 0 ? 0 : progress > 1 ? 1 : progress;
    this.targetFrame = Math.round(clamped * (this.frameCount - 1));
    if (!this.rafId) this.rafId = requestAnimationFrame(this.tick);
  }

  private tick = () => {
    this.rafId = 0;
    this.draw(this.targetFrame);
  };

  destroy(): void {
    this.destroyed = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    window.removeEventListener("resize", this.handleResize);
    window.removeEventListener("orientationchange", this.handleResize);
    for (const frame of this.frames) {
      if (frame && "close" in frame) frame.close();
    }
    this.frames = [];
  }
}
