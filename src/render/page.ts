import { Puzzle, Theme } from '../model/types';
import { entries, enumFor } from '../model/puzzle';
import { gridSize, renderGrid } from './grid';
import { Measurer, Op, wrap } from './ops';

export interface Page {
  w: number;
  h: number;
  ops: Op[];
}

export interface PageOptions {
  theme: Theme;
  /** Page size in points (PDF) or arbitrary units; raster scales afterwards. */
  pageW: number;
  pageH: number;
  withClues: boolean;
  showLetters: boolean;
  measurer: Measurer;
  dateLine?: string;
  /** Page colour; exports use white paper. */
  background?: string;
}

export const LETTER = { w: 612, h: 792 } as const;
export const PAPER_WHITE = '#FFFFFF';

export function paperSize(orientation: 'portrait' | 'landscape'): { w: number; h: number } {
  return orientation === 'landscape' ? { w: LETTER.h, h: LETTER.w } : { w: LETTER.w, h: LETTER.h };
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Lay the puzzle out on one or more pages. In portrait the grid sits above two clue
 * columns; in landscape it sits at the left with the clue columns beside it.
 */
export function layoutPages(p: Puzzle, o: PageOptions): Page[] {
  const th = o.theme.colors;
  const paper = o.background ?? PAPER_WHITE;
  const m = 48;
  const W = o.pageW, H = o.pageH;
  const landscape = W > H && o.withClues;
  const pages: Page[] = [];
  let ops: Op[] = [];
  const bg = (): Op => ({ kind: 'path', d: `M0,0h${W}v${H}h${-W}Z`, fill: paper });
  ops.push(bg());
  let y = m;

  // title block
  const title = p.title.trim();
  if (title) {
    ops.push({ kind: 'text', x: m, y: y + 20, text: title, role: 'clues', size: 20, fill: th.ink, bold: true });
    y += 30;
  }
  const by = [p.author.trim(), o.dateLine ?? ''].filter(Boolean).join(' · ');
  if (by) {
    ops.push({ kind: 'text', x: m, y: y + 10, text: by, role: 'clues', size: 10, fill: th.muted });
    y += 18;
  }
  if (title || by) y += 10;

  // grid
  const g = gridSize(p.cells, 1);
  const cols = Math.max(g.w, 1), rows = Math.max(g.h, 1);
  const gap = 24;
  let gridRect: Rect;
  let firstColumns: Rect[];
  if (!o.withClues) {
    const S = Math.min(40, (W - 2 * m) / cols, (H - y - m) / rows);
    gridRect = { x: (W - cols * S) / 2, y, w: cols * S, h: rows * S };
    firstColumns = [];
  } else if (landscape) {
    const leftW = (W - 2 * m - gap) * 0.5;
    const S = Math.min(28, leftW / cols, (H - y - m) / rows);
    gridRect = { x: m + (leftW - cols * S) / 2, y, w: cols * S, h: rows * S };
    const rightX = m + leftW + gap, rightW = W - m - rightX;
    const colW = (rightW - gap) / 2;
    firstColumns = [
      { x: rightX, y, w: colW, h: H - m - y },
      { x: rightX + colW + gap, y, w: colW, h: H - m - y },
    ];
  } else {
    const S = Math.min(26, (W - 2 * m) / cols, (H - y - m) / rows);
    gridRect = { x: (W - cols * S) / 2, y, w: cols * S, h: rows * S };
    const top = y + rows * S + 24;
    const colW = (W - 2 * m - gap) / 2;
    firstColumns = [
      { x: m, y: top, w: colW, h: H - m - top },
      { x: m + colW + gap, y: top, w: colW, h: H - m - top },
    ];
  }
  const S = gridRect.w / cols;
  ops.push(...translate(renderGrid(p.cells, { cellSize: S, theme: o.theme, showLetters: o.showLetters, showNumbers: true, background: paper }), gridRect.x, gridRect.y));

  if (!o.withClues) {
    pages.push({ w: W, h: H, ops });
    return pages;
  }

  // clue lines, wrapped to the narrowest column in use
  const size = 9.5, lh = size * 1.4, indent = 18;
  const colW = Math.min(...firstColumns.map((c) => c.w));
  const es = entries(p);
  type Line = { text: string; num?: string; heading?: boolean };
  const lines: Line[] = [];
  for (const dir of ['A', 'D'] as const) {
    lines.push({ text: dir === 'A' ? 'Across' : 'Down', heading: true });
    for (const e of es.filter((e) => e.dir === dir)) {
      const text = `${e.clue.trim() || ' '} (${enumFor(e)})`;
      const wrapped = wrap(text, 'clues', size, colW - indent, o.measurer);
      wrapped.forEach((t, i) => lines.push({ text: t, num: i === 0 ? String(e.number) : undefined }));
    }
    lines.push({ text: '' });
  }

  // flow through the first page's columns, then full-page columns
  const laterColumns = (): Rect[] => {
    const cw = (W - 2 * m - gap) / 2;
    return [
      { x: m, y: m, w: cw, h: H - 2 * m },
      { x: m + cw + gap, y: m, w: cw, h: H - 2 * m },
    ];
  };
  let columns = firstColumns;
  let col = 0;
  let cy = columns[0].y;
  const nextColumn = () => {
    col++;
    if (col >= columns.length) {
      pages.push({ w: W, h: H, ops });
      ops = [bg()];
      columns = laterColumns();
      col = 0;
    }
    cy = columns[col].y;
  };
  for (const ln of lines) {
    const need = ln.heading ? lh * 1.6 : lh;
    if (cy + need > columns[col].y + columns[col].h) nextColumn();
    const x = columns[col].x;
    if (ln.heading) {
      cy += lh * 0.4;
      ops.push({ kind: 'text', x, y: cy + size, text: ln.text, role: 'clues', size: size + 2, fill: th.ink, bold: true });
      cy += lh * 1.2;
      continue;
    }
    if (ln.num) ops.push({ kind: 'text', x, y: cy + size, text: ln.num, role: 'numbers', size, fill: th.ink, bold: true });
    if (ln.text.trim()) ops.push({ kind: 'text', x: x + indent, y: cy + size, text: ln.text, role: 'clues', size, fill: th.ink });
    cy += lh;
  }
  pages.push({ w: W, h: H, ops });
  return pages;
}

/** Grid alone with padding, for raster/SVG "grid only" export. */
export function layoutGridOnly(p: Puzzle, theme: Theme, showLetters: boolean, cellSize = 40, background = PAPER_WHITE): Page {
  const pad = cellSize * 0.5;
  const g = gridSize(p.cells, cellSize);
  const ops: Op[] = [{ kind: 'path', d: `M0,0h${g.w + 2 * pad}v${g.h + 2 * pad}h${-(g.w + 2 * pad)}Z`, fill: background }];
  ops.push(...translate(renderGrid(p.cells, { cellSize, theme, showLetters, background }), pad, pad));
  return { w: g.w + 2 * pad, h: g.h + 2 * pad, ops };
}

export function translate(ops: Op[], dx: number, dy: number): Op[] {
  return ops.map((op) => {
    if (op.kind === 'text') return { ...op, x: op.x + dx, y: op.y + dy };
    if (op.kind === 'circle') return { ...op, cx: op.cx + dx, cy: op.cy + dy };
    return { ...op, d: translatePath(op.d, dx, dy) };
  });
}

/** Translate an absolute-command path (M/H/V/A/L/Z plus relative h/v) by (dx,dy). */
export function translatePath(d: string, dx: number, dy: number): string {
  return d.replace(/([MHVLAhv])([^MHVLAZhvz]*)/g, (_, cmd: string, args: string) => {
    const nums = args.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    switch (cmd) {
      case 'M':
      case 'L':
        return `${cmd}${nums[0] + dx},${nums[1] + dy}`;
      case 'H':
        return `H${nums[0] + dx}`;
      case 'V':
        return `V${nums[0] + dy}`;
      case 'A':
        return `A${nums[0]},${nums[1]} ${nums[2]} ${nums[3]} ${nums[4]} ${nums[5] + dx},${nums[6] + dy}`;
      default:
        return cmd + args; // relative h/v unchanged
    }
  });
}
