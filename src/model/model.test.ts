import { describe, expect, it } from 'vitest';
import { Cells, computeSlots, corners, cellPath, isolatedCells } from './grid';
import { cellKey, clueKey, Puzzle } from './types';
import { newPuzzle, reattachClues, toJSON, fromJSON, entries, enumLength } from './puzzle';
import { encodePuzzle, decodePuzzle } from './codec';

/** Build cells from an ASCII picture: '.' = void, letters/'_' = cell. */
function grid(pic: string[]): Cells {
  const cells: Cells = new Map();
  pic.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (ch !== '.') cells.set(cellKey(r, c), { r, c, l: ch === '_' ? '' : ch.toUpperCase() });
    });
  });
  return cells;
}

describe('numbering', () => {
  it('numbers a small grid in row-major order, sharing numbers across/down', () => {
    const cells = grid(['abc', 'd.e', 'fgh']);
    const slots = computeSlots(cells);
    const labels = slots.map((s) => `${s.number}${s.dir}:${s.len}`);
    expect(labels).toEqual(['1A:3', '1D:3', '2D:3', '3A:3']);
  });

  it('ignores runs of length one', () => {
    const cells = grid(['a.b', '...', 'c.d']);
    expect(computeSlots(cells)).toEqual([]);
    expect(isolatedCells(cells, []).size).toBe(4);
  });

  it('handles negative coordinates', () => {
    const cells: Cells = new Map();
    for (let c = -2; c <= 0; c++) cells.set(cellKey(-1, c), { r: -1, c, l: '' });
    const slots = computeSlots(cells);
    expect(slots).toEqual([{ r: -1, c: -2, dir: 'A', len: 3, number: 1 }]);
  });
});

describe('corner rule', () => {
  it('rounds all corners of an island', () => {
    const cells = grid(['a']);
    expect(corners(cells, 0, 0)).toEqual({ tl: true, tr: true, bl: true, br: true });
  });
  it('rounds only the ends of a strip', () => {
    const cells = grid(['abc']);
    expect(corners(cells, 0, 0)).toEqual({ tl: true, tr: false, bl: true, br: false });
    expect(corners(cells, 0, 1)).toEqual({ tl: false, tr: false, bl: false, br: false });
    expect(corners(cells, 0, 2)).toEqual({ tl: false, tr: true, bl: false, br: true });
  });
  it('rounds only the outside corners of a rectangle', () => {
    const cells = grid(['ab', 'cd']);
    expect(corners(cells, 0, 0)).toEqual({ tl: true, tr: false, bl: false, br: false });
    expect(corners(cells, 1, 1)).toEqual({ tl: false, tr: false, bl: false, br: true });
  });
  it('ignores the diagonal neighbour', () => {
    const cells = grid(['a.', '.b']);
    expect(corners(cells, 0, 0).br).toBe(true);
  });
  it('produces a closed path', () => {
    const p = cellPath(0, 0, 10, 2, { tl: true, tr: false, bl: false, br: true });
    expect(p.startsWith('M2,0')).toBe(true);
    expect(p.endsWith('Z')).toBe(true);
    expect(p.match(/A/g)?.length).toBe(2);
  });
});

function puzzleFrom(pic: string[]): Puzzle {
  const p = newPuzzle();
  p.cells = grid(pic);
  return p;
}

describe('clue reattachment', () => {
  it('keeps a clue through renumbering', () => {
    const p = puzzleFrom(['...', 'abc']);
    p.clues.set(clueKey(1, 0, 'A'), { clue: 'first', enum: '' });
    expect(entries(p)[0].number).toBe(1);
    const oldSlots = computeSlots(p.cells);
    const oldCells = new Map(p.cells);
    // add a down slot above-left, which takes number 1
    p.cells.set(cellKey(0, 0), { r: 0, c: 0, l: 'X' });
    reattachClues(p, oldSlots, oldCells);
    const es = entries(p);
    const across = es.find((e) => e.dir === 'A')!;
    expect(across.number).toBe(2); // 1D is new; the across entry is renumbered
    expect(across.clue).toBe('first');
  });

  it('follows a slot extended at the front', () => {
    const p = puzzleFrom(['.abc']);
    p.clues.set(clueKey(0, 1, 'A'), { clue: 'c', enum: '' });
    const oldSlots = computeSlots(p.cells);
    const oldCells = new Map(p.cells);
    p.cells.set(cellKey(0, 0), { r: 0, c: 0, l: 'Z' });
    reattachClues(p, oldSlots, oldCells);
    expect(p.clues.get(clueKey(0, 0, 'A'))?.clue).toBe('c');
  });

  it('orphans a clue whose slot vanished, keeping its answer', () => {
    const p = puzzleFrom(['abc']);
    p.clues.set(clueKey(0, 0, 'A'), { clue: 'gone', enum: '3' });
    const oldSlots = computeSlots(p.cells);
    const oldCells = new Map(p.cells);
    p.cells.delete(cellKey(0, 1));
    reattachClues(p, oldSlots, oldCells);
    expect(p.clues.size).toBe(0);
    expect(p.orphans).toEqual([{ clue: 'gone', enum: '3', dir: 'A', answer: 'ABC' }]);
  });
});

describe('serialization', () => {
  it('round-trips through JSON and the share codec', () => {
    const p = puzzleFrom(['stars', 'o...u', 'ferns']);
    p.title = 'Test';
    p.clues.set(clueKey(0, 0, 'A'), { clue: 'Heavenly bodies', enum: '5' });
    p.clues.set(clueKey(0, 0, 'D'), { clue: 'Thus', enum: '' });
    const j = toJSON(p);
    expect(Object.keys(j.clues)).toEqual(['1A', '1D']);
    const back = fromJSON(decodePuzzle(encodePuzzle(j)));
    expect(back.title).toBe('Test');
    expect(back.cells.size).toBe(p.cells.size);
    expect(back.clues.get(clueKey(0, 0, 'A'))).toEqual({ clue: 'Heavenly bodies', enum: '5' });
    expect(entries(back).map((e) => e.answer)).toEqual(['STARS', 'SOF', 'SUS', 'FERNS']);
  });

  it('keeps share links small', () => {
    const p = newPuzzle();
    for (let r = 0; r < 15; r++)
      for (let c = 0; c < 15; c++)
        if (r % 2 === 0 || c % 2 === 0) p.cells.set(cellKey(r, c), { r, c, l: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[(r * 7 + c * 3) % 26] });
    for (const s of computeSlots(p.cells))
      p.clues.set(clueKey(s.r, s.c, s.dir), { clue: 'A clue of ordinary length for a cryptic crossword entry (anag.)', enum: '' });
    const len = encodePuzzle(toJSON(p)).length;
    expect(len).toBeLessThan(4000);
  });
});

describe('enumeration', () => {
  it('sums parts', () => {
    expect(enumLength('5,4')).toBe(9);
    expect(enumLength('3-6')).toBe(9);
    expect(enumLength("5'1")).toBe(6);
    expect(enumLength('x')).toBeNaN();
  });
});
