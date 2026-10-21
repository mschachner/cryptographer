import { Cell, Dir, Slot, cellKey } from './types';

export type Cells = Map<string, Cell>;

export const has = (cells: Cells, r: number, c: number) => cells.has(cellKey(r, c));

export function bounds(cells: Cells): { r0: number; c0: number; r1: number; c1: number } | null {
  if (cells.size === 0) return null;
  let r0 = Infinity, c0 = Infinity, r1 = -Infinity, c1 = -Infinity;
  for (const { r, c } of cells.values()) {
    if (r < r0) r0 = r;
    if (c < c0) c0 = c;
    if (r > r1) r1 = r;
    if (c > c1) c1 = c;
  }
  return { r0, c0, r1, c1 };
}

/**
 * Find all slots (maximal runs of length >= 2) and assign standard numbering:
 * row-major scan; a cell beginning at least one slot gets the next integer.
 */
export function computeSlots(cells: Cells): Slot[] {
  const b = bounds(cells);
  if (!b) return [];
  const slots: Slot[] = [];
  let n = 0;
  for (let r = b.r0; r <= b.r1; r++) {
    for (let c = b.c0; c <= b.c1; c++) {
      if (!has(cells, r, c)) continue;
      const startsA = !has(cells, r, c - 1) && has(cells, r, c + 1);
      const startsD = !has(cells, r - 1, c) && has(cells, r + 1, c);
      if (!startsA && !startsD) continue;
      n++;
      if (startsA) {
        let len = 1;
        while (has(cells, r, c + len)) len++;
        slots.push({ r, c, dir: 'A', len, number: n });
      }
      if (startsD) {
        let len = 1;
        while (has(cells, r + len, c)) len++;
        slots.push({ r, c, dir: 'D', len, number: n });
      }
    }
  }
  return slots;
}

export function slotCells(s: Slot): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < s.len; i++) out.push(s.dir === 'A' ? [s.r, s.c + i] : [s.r + i, s.c]);
  return out;
}

export function slotAnswer(cells: Cells, s: Slot): string {
  return slotCells(s)
    .map(([r, c]) => cells.get(cellKey(r, c))?.l || '·')
    .join('');
}

/** The slot in direction `dir` containing cell (r,c), if any. */
export function slotThrough(slots: Slot[], r: number, c: number, dir: Dir): Slot | undefined {
  return slots.find((s) => s.dir === dir && slotCells(s).some(([rr, cc]) => rr === r && cc === c));
}

/** Map from "r,c" to clue number, for cells that begin a slot. */
export function numberMap(slots: Slot[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of slots) m.set(cellKey(s.r, s.c), s.number);
  return m;
}

export interface Corners {
  tl: boolean;
  tr: boolean;
  bl: boolean;
  br: boolean;
}

/**
 * A corner is rounded iff both edge-adjacent squares at that corner are void.
 * The diagonal neighbour is ignored.
 */
export function corners(cells: Cells, r: number, c: number): Corners {
  const up = has(cells, r - 1, c);
  const down = has(cells, r + 1, c);
  const left = has(cells, r, c - 1);
  const right = has(cells, r, c + 1);
  return {
    tl: !up && !left,
    tr: !up && !right,
    bl: !down && !left,
    br: !down && !right,
  };
}

/**
 * SVG path for a square of side `s` at (x,y) with the given corners rounded by radius `rad`.
 */
export function cellPath(x: number, y: number, s: number, rad: number, k: Corners): string {
  const r = Math.min(rad, s / 2);
  const p: string[] = [];
  // start at top edge, after the top-left corner
  p.push(`M${x + (k.tl ? r : 0)},${y}`);
  p.push(`H${x + s - (k.tr ? r : 0)}`);
  if (k.tr) p.push(`A${r},${r} 0 0 1 ${x + s},${y + r}`);
  p.push(`V${y + s - (k.br ? r : 0)}`);
  if (k.br) p.push(`A${r},${r} 0 0 1 ${x + s - r},${y + s}`);
  p.push(`H${x + (k.bl ? r : 0)}`);
  if (k.bl) p.push(`A${r},${r} 0 0 1 ${x},${y + s - r}`);
  p.push(`V${y + (k.tl ? r : 0)}`);
  if (k.tl) p.push(`A${r},${r} 0 0 1 ${x + r},${y}`);
  p.push('Z');
  return p.join('');
}

/** Cells that belong to no slot. */
export function isolatedCells(cells: Cells, slots: Slot[]): Set<string> {
  const covered = new Set<string>();
  for (const s of slots) for (const [r, c] of slotCells(s)) covered.add(cellKey(r, c));
  const out = new Set<string>();
  for (const k of cells.keys()) if (!covered.has(k)) out.add(k);
  return out;
}

/** Image of (r,c) under 180° rotation about the centre of the bounding box. */
export function rotate180(cells: Cells, r: number, c: number): [number, number] {
  const b = bounds(cells);
  if (!b) return [r, c];
  return [b.r0 + b.r1 - r, b.c0 + b.c1 - c];
}
