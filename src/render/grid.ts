import { Cells, bounds, cellPath, computeSlots, corners, numberMap } from '../model/grid';
import { Theme, cellKey } from '../model/types';
import { Op } from './ops';

export interface GridRenderOptions {
  cellSize: number;
  theme: Theme;
  /** Cell (r0,c0) is drawn at (0,0). Defaults to the bounding box origin. */
  origin?: { r: number; c: number };
  showLetters?: boolean;
  showNumbers?: boolean;
  /** Letters to draw instead of the puzzle's own (solver's fill). */
  overlay?: Map<string, string>;
  cursor?: { r: number; c: number } | null;
  slot?: Set<string>; // keys of cells in the current slot
  wrong?: Set<string>; // solver check marks
  isolated?: Set<string>; // cells in no slot (dashed outline)
  /** The colour the grid is drawn on; void squares inside the grid are painted when `block` differs from it. */
  background?: string;
}

/** Letter/number placement constants shared by every renderer. */
export const LETTER_SIZE = 0.6; // of cell size
export const LETTER_BASELINE = 0.5 + 0.6 * 0.36; // centre + cap-height/2
export const NUMBER_SIZE = 0.26;
export const NUMBER_X = 0.09;
export const NUMBER_BASELINE = 0.09 + 0.26 * 0.74;

export function renderGrid(cells: Cells, o: GridRenderOptions): Op[] {
  const S = o.cellSize;
  const b = bounds(cells);
  if (!b) return [];
  const origin = o.origin ?? { r: b.r0, c: b.c0 };
  const th = o.theme.colors;
  const rad = o.theme.cornerRadius * S;
  const ops: Op[] = [];
  const slots = computeSlots(cells);
  const nums = numberMap(slots);
  const showNumbers = o.showNumbers ?? true;
  const showLetters = o.showLetters ?? true;
  const stroke = Math.max(1, S * 0.035);

  const bgColor = (o.background ?? th.page).toLowerCase();
  if ((th.block ?? th.page).toLowerCase() !== bgColor) {
    for (let r = b.r0; r <= b.r1; r++)
      for (let c = b.c0; c <= b.c1; c++)
        if (!cells.has(cellKey(r, c))) {
          const x = (c - origin.c) * S, y = (r - origin.r) * S;
          ops.push({ kind: 'path', d: `M${x},${y}h${S}v${S}h${-S}Z`, fill: th.block });
        }
  }

  // cell bodies
  for (const cell of cells.values()) {
    const x = (cell.c - origin.c) * S, y = (cell.r - origin.r) * S;
    const k = cellKey(cell.r, cell.c);
    const isCursor = o.cursor && o.cursor.r === cell.r && o.cursor.c === cell.c;
    const inSlot = o.slot?.has(k);
    const fill = isCursor ? th.accent : inSlot ? th.highlight : th.cell;
    const iso = o.isolated?.has(k);
    ops.push({
      kind: 'path',
      d: cellPath(x, y, S, rad, corners(cells, cell.r, cell.c)),
      fill,
      stroke: th.cellOutline,
      strokeWidth: stroke,
      dash: iso ? [S * 0.12, S * 0.08] : undefined,
      data: { r: cell.r, c: cell.c },
      cls: 'cell',
    });
  }

  // numbers and letters, on top of all bodies
  for (const cell of cells.values()) {
    const x = (cell.c - origin.c) * S, y = (cell.r - origin.r) * S;
    const k = cellKey(cell.r, cell.c);
    const isCursor = o.cursor && o.cursor.r === cell.r && o.cursor.c === cell.c;
    const n = nums.get(k);
    if (showNumbers && n !== undefined) {
      ops.push({
        kind: 'text',
        x: x + NUMBER_X * S,
        y: y + NUMBER_BASELINE * S,
        text: String(n),
        role: 'numbers',
        size: NUMBER_SIZE * S,
        fill: th.number,
      });
    }
    const letter = o.overlay ? o.overlay.get(k) ?? '' : showLetters ? cell.l : '';
    if (letter) {
      const wrong = o.wrong?.has(k);
      ops.push({
        kind: 'text',
        x: x + S / 2,
        y: y + LETTER_BASELINE * S,
        text: letter,
        role: 'answers',
        size: LETTER_SIZE * S,
        fill: wrong ? '#B03A2E' : th.ink,
        anchor: 'middle',
      });
    } else if (!o.overlay && showLetters && !cell.l) {
      ops.push({ kind: 'circle', cx: x + S / 2, cy: y + S / 2, r: S * 0.05, fill: th.muted });
    }
  }
  return ops;
}

export function gridSize(cells: Cells, S: number): { w: number; h: number } {
  const b = bounds(cells);
  if (!b) return { w: 0, h: 0 };
  return { w: (b.c1 - b.c0 + 1) * S, h: (b.r1 - b.r0 + 1) * S };
}
