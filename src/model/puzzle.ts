import {
  Cell,
  ClueKey,
  ClueText,
  Dir,
  Entry,
  OrphanClue,
  Puzzle,
  PuzzleJSON,
  Slot,
  cellKey,
  clueKey,
} from './types';
import { Cells, computeSlots, slotAnswer, slotCells } from './grid';

export function newId(prefix: string): string {
  const a = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = prefix + '_';
  for (let i = 0; i < 8; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

export function newPuzzle(): Puzzle {
  const now = new Date().toISOString();
  return {
    schema: 1,
    id: newId('p'),
    title: '',
    author: '',
    notes: '',
    created: now,
    modified: now,
    cells: new Map(),
    clues: new Map(),
    orphans: [],
    theme: 'heather',
    fonts: 'default',
  };
}

export function entries(p: Puzzle, slots = computeSlots(p.cells)): Entry[] {
  return slots.map((s) => {
    const t = p.clues.get(clueKey(s.r, s.c, s.dir));
    return { ...s, answer: slotAnswer(p.cells, s), clue: t?.clue ?? '', enum: t?.enum ?? '' };
  });
}

export function entryLabel(e: Slot): string {
  return `${e.number}${e.dir}`;
}

/** Printed enumeration: the stored one, or the slot length. */
export function enumFor(e: Entry): string {
  return e.enum || String(e.len);
}

export const ENUM_RE = /^[0-9]+([,'\-][0-9]+)*$/;

/** Sum of the numbers in an enumeration, or NaN if malformed. */
export function enumLength(en: string): number {
  if (!ENUM_RE.test(en)) return NaN;
  return en.split(/[,'\-]/).reduce((a, b) => a + parseInt(b, 10), 0);
}

/**
 * After the grid has changed, reattach every clue to the slot that begins at the same
 * cell in the same direction; failing that, to the unique slot in that direction that
 * contains the old start cell; failing that, move it to the orphan list.
 * `oldAnswers` supplies the answers for orphans.
 */
export function reattachClues(p: Puzzle, oldSlots: Slot[], oldCells: Cells): void {
  const slots = computeSlots(p.cells);
  const next = new Map<ClueKey, ClueText>();
  const orphans: OrphanClue[] = [...p.orphans];
  for (const [key, text] of p.clues) {
    if (!text.clue && !text.enum) continue;
    const [rs, cs, d] = key.split(',');
    const r = +rs, c = +cs, dir = d as Dir;
    let target = slots.find((s) => s.dir === dir && s.r === r && s.c === c);
    if (!target) {
      const containing = slots.filter((s) => s.dir === dir && slotCells(s).some(([rr, cc]) => rr === r && cc === c));
      if (containing.length === 1) target = containing[0];
    }
    if (target) {
      const tk = clueKey(target.r, target.c, target.dir);
      if (!next.has(tk)) next.set(tk, text);
      else orphans.push({ ...text, dir, answer: answerOf(oldSlots, oldCells, r, c, dir) });
    } else {
      orphans.push({ ...text, dir, answer: answerOf(oldSlots, oldCells, r, c, dir) });
    }
  }
  p.clues = next;
  p.orphans = orphans;
}

function answerOf(slots: Slot[], cells: Cells, r: number, c: number, dir: Dir): string {
  const s = slots.find((s) => s.dir === dir && s.r === r && s.c === c);
  return s ? slotAnswer(cells, s).replace(/·/g, '?') : '';
}

export function toJSON(p: Puzzle): PuzzleJSON {
  const slots = computeSlots(p.cells);
  const clues: Record<string, ClueText> = {};
  for (const s of slots) {
    const t = p.clues.get(clueKey(s.r, s.c, s.dir));
    if (t && (t.clue || t.enum)) clues[entryLabel(s)] = { clue: t.clue, enum: t.enum };
  }
  const cells = [...p.cells.values()].sort((a, b) => a.r - b.r || a.c - b.c);
  return {
    schema: 1,
    id: p.id,
    title: p.title,
    author: p.author,
    notes: p.notes,
    created: p.created,
    modified: p.modified,
    cells,
    clues,
    orphans: p.orphans.length ? p.orphans : undefined,
    theme: p.theme,
    fonts: p.fonts,
  };
}

export function fromJSON(j: PuzzleJSON): Puzzle {
  const cells: Cells = new Map();
  for (const c of j.cells) cells.set(cellKey(c.r, c.c), { r: c.r, c: c.c, l: (c.l || '').toUpperCase() });
  const slots = computeSlots(cells);
  const clues = new Map<ClueKey, ClueText>();
  for (const [label, t] of Object.entries(j.clues ?? {})) {
    const m = /^(\d+)([AD])$/.exec(label);
    if (!m) continue;
    const s = slots.find((s) => s.number === +m[1] && s.dir === m[2]);
    if (s) clues.set(clueKey(s.r, s.c, s.dir), { clue: t.clue ?? '', enum: t.enum ?? '' });
  }
  return {
    schema: 1,
    id: j.id || newId('p'),
    title: j.title ?? '',
    author: j.author ?? '',
    notes: j.notes ?? '',
    created: j.created ?? new Date().toISOString(),
    modified: j.modified ?? new Date().toISOString(),
    cells,
    clues,
    orphans: j.orphans ?? [],
    theme: j.theme ?? 'heather',
    fonts: j.fonts ?? 'default',
  };
}

/** Deep copy (cells and clues are maps). */
export function clonePuzzle(p: Puzzle): Puzzle {
  return {
    ...p,
    cells: new Map([...p.cells].map(([k, v]) => [k, { ...v }])),
    clues: new Map([...p.clues].map(([k, v]) => [k, { ...v }])),
    orphans: p.orphans.map((o) => ({ ...o })),
  };
}

/** Strip letters (for share-without-answers). */
export function withoutAnswers(j: PuzzleJSON): PuzzleJSON {
  return { ...j, cells: j.cells.map((c) => ({ ...c, l: '' })) };
}

export function isComplete(p: Puzzle): { entries: number; clued: number; empty: number } {
  const es = entries(p);
  let empty = 0;
  for (const c of p.cells.values()) if (!c.l) empty++;
  return { entries: es.length, clued: es.filter((e) => e.clue.trim()).length, empty };
}

export function cellAt(p: Puzzle, r: number, c: number): Cell | undefined {
  return p.cells.get(cellKey(r, c));
}
