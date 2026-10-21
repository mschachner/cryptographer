import { Cells, bounds } from '../model/grid';
import { FontSet } from '../model/types';
import { Op } from '../render/ops';
import { opsToSvgInner } from '../render/svg';
import { h } from './dom';

export interface View {
  x: number;
  y: number;
  k: number;
}

/**
 * Pannable, zoomable SVG canvas. Cell (r,c) occupies [c*S, (c+1)*S] × [r*S, (r+1)*S]
 * in world units; the view maps world to screen.
 */
export class GridView {
  readonly el: HTMLDivElement;
  readonly svg: SVGSVGElement;
  private world: SVGGElement;
  private bgRect: SVGRectElement;
  private cellsG: SVGGElement;
  view: View = { x: 40, y: 40, k: 1 };
  readonly S = 48;
  showGuide = true;
  onCellPointerDown?: (r: number, c: number, e: PointerEvent) => void;
  onCellPointerMove?: (r: number, c: number, e: PointerEvent) => void;
  onPointerUp?: (e: PointerEvent) => void;

  constructor(private fonts: FontSet) {
    this.el = h('div.canvas', { tabindex: 0 });
    this.el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="grid-svg">
      <defs>
        <pattern id="guide" width="${this.S}" height="${this.S}" patternUnits="userSpaceOnUse">
          <path d="M${this.S},0V${this.S}H0" fill="none" stroke="var(--c-muted)" stroke-opacity="0.35" stroke-width="1"/>
        </pattern>
      </defs>
      <g class="world">
        <rect class="guide" x="-100000" y="-100000" width="200000" height="200000" fill="url(#guide)"/>
        <g class="cells"></g>
      </g></svg>`;
    this.svg = this.el.querySelector('svg')!;
    this.world = this.svg.querySelector('g.world')!;
    this.bgRect = this.svg.querySelector('rect.guide')!;
    this.cellsG = this.svg.querySelector('g.cells')!;
    this.bindPointer();
    this.applyView();
  }

  setFonts(f: FontSet) {
    this.fonts = f;
  }

  render(ops: Op[]) {
    this.cellsG.innerHTML = opsToSvgInner(ops, this.fonts);
    this.bgRect.style.display = this.showGuide ? '' : 'none';
  }

  applyView() {
    const { x, y, k } = this.view;
    // whole-pixel translation keeps cell borders from landing between pixels
    this.world.setAttribute('transform', `translate(${Math.round(x)},${Math.round(y)}) scale(${k})`);
  }

  /** Snap a zoom factor so that a cell is a whole number of pixels wide. */
  private snap(k: number): number {
    return Math.max(8, Math.round(this.S * k)) / this.S;
  }

  /** Screen → world. */
  toWorld(clientX: number, clientY: number): [number, number] {
    const b = this.svg.getBoundingClientRect();
    return [(clientX - b.left - this.view.x) / this.view.k, (clientY - b.top - this.view.y) / this.view.k];
  }

  cellAtPointer(e: { clientX: number; clientY: number }): [number, number] {
    const [wx, wy] = this.toWorld(e.clientX, e.clientY);
    return [Math.floor(wy / this.S), Math.floor(wx / this.S)];
  }

  /** Frame the puzzle (or the origin when empty). */
  fit(cells: Cells) {
    const b = bounds(cells);
    const W = this.el.clientWidth || 800, H = this.el.clientHeight || 600;
    if (!b) {
      this.view = { x: W / 2 - 3 * this.S, y: H / 2 - 3 * this.S, k: 1 };
    } else {
      const gw = (b.c1 - b.c0 + 1) * this.S, gh = (b.r1 - b.r0 + 1) * this.S;
      const k = this.snap(Math.min(1.6, Math.max(0.2, Math.min((W - 80) / gw, (H - 80) / gh))));
      this.view = { x: (W - gw * k) / 2 - b.c0 * this.S * k, y: (H - gh * k) / 2 - b.r0 * this.S * k, k };
    }
    this.applyView();
  }

  /** Make sure cell (r,c) is visible; pan minimally. */
  reveal(r: number, c: number) {
    const W = this.el.clientWidth, H = this.el.clientHeight;
    if (!W || !H) return;
    const k = this.view.k, S = this.S * k;
    const sx = c * S + this.view.x, sy = r * S + this.view.y;
    const pad = S;
    if (sx < pad) this.view.x += pad - sx;
    else if (sx + S > W - pad) this.view.x -= sx + S - (W - pad);
    if (sy < pad) this.view.y += pad - sy;
    else if (sy + S > H - pad) this.view.y -= sy + S - (H - pad);
    this.applyView();
  }

  zoomBy(f: number, cx?: number, cy?: number) {
    const W = this.el.clientWidth, H = this.el.clientHeight;
    const px = cx ?? W / 2, py = cy ?? H / 2;
    const k2 = this.snap(Math.min(4, Math.max(0.15, this.view.k * f)));
    const r = k2 / this.view.k;
    this.view = { x: px - (px - this.view.x) * r, y: py - (py - this.view.y) * r, k: k2 };
    this.applyView();
  }

  private bindPointer() {
    let panning: { sx: number; sy: number; vx: number; vy: number; moved: boolean; start: PointerEvent } | null = null;
    // keep keyboard focus on the canvas: the default mousedown focus handling can drop it to <body>
    this.svg.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.el.focus();
    });
    this.svg.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      this.el.focus();
      panning = { sx: e.clientX, sy: e.clientY, vx: this.view.x, vy: this.view.y, moved: false, start: e };
      this.svg.setPointerCapture(e.pointerId);
      const [r, c] = this.cellAtPointer(e);
      this.onCellPointerDown?.(r, c, e);
    });
    this.svg.addEventListener('pointermove', (e) => {
      if (!panning) return;
      const dx = e.clientX - panning.sx, dy = e.clientY - panning.sy;
      if (!panning.moved && Math.hypot(dx, dy) < 4) return;
      panning.moved = true;
      if (panning.start.shiftKey) {
        const [r, c] = this.cellAtPointer(e);
        this.onCellPointerMove?.(r, c, e);
        return;
      }
      this.view.x = panning.vx + dx;
      this.view.y = panning.vy + dy;
      this.applyView();
    });
    const end = (e: PointerEvent) => {
      if (!panning) return;
      panning = null;
      this.onPointerUp?.(e);
    };
    this.svg.addEventListener('pointerup', end);
    this.svg.addEventListener('pointercancel', end);
    this.svg.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const b = this.svg.getBoundingClientRect();
        if (e.ctrlKey || e.metaKey) this.zoomBy(Math.exp(-e.deltaY * 0.01), e.clientX - b.left, e.clientY - b.top);
        else {
          this.view.x -= e.deltaX;
          this.view.y -= e.deltaY;
          this.applyView();
        }
      },
      { passive: false },
    );
  }
}
