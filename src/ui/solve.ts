import { computeSlots, slotCells, slotThrough } from '../model/grid';
import { Dir, Puzzle, cellKey } from '../model/types';
import { entries, enumFor, fromJSON, newPuzzle } from '../model/puzzle';
import { decodePuzzle, hashString } from '../model/codec';
import { renderGrid } from '../render/grid';
import { progressStore, puzzleStore } from '../store/db';
import { applyChrome, currentFonts, currentTheme, go, mount, nav } from './app';
import { GridView } from './gridView';
import { h, clear, toast } from './dom';
import { openExportDialog } from './exportDialog';
import { iconButton } from './icons';

export function solveScreen(root: HTMLElement, opts: { payload?: string; puzzle?: Puzzle }) {
  let p: Puzzle;
  let hash: string;
  if (opts.puzzle) {
    p = opts.puzzle;
    hash = 'preview:' + p.id;
  } else {
    try {
      p = fromJSON(decodePuzzle(opts.payload!));
    } catch {
      mount(root, nav('library'), h('main', h('div.warn', 'This link could not be read.')));
      return;
    }
    hash = hashString(opts.payload!);
  }
  const hasAnswers = [...p.cells.values()].some((c) => c.l);
  const theme = currentTheme();
  const fonts = currentFonts();
  applyChrome(theme, fonts);

  const fill = new Map<string, string>(Object.entries(progressStore.get(hash)));
  let cursor = (() => {
    const first = [...p.cells.values()].sort((a, b) => a.r - b.r || a.c - b.c)[0];
    return first ? { r: first.r, c: first.c } : { r: 0, c: 0 };
  })();
  let dir: Dir = 'A';
  let wrong = new Set<string>();

  const view = new GridView(fonts);
  view.showGuide = false;
  const panel = h('aside.clue-panel');
  const dirBtn = h('button.ghost', { onclick: () => { dir = dir === 'A' ? 'D' : 'A'; dirBtn.textContent = dir === 'A' ? 'Across' : 'Down'; draw(); } }, 'Across');
  const toolbar = h(
    'div.toolbar',
    h('div.group', h('span.title-static', p.title || 'Untitled'), p.author ? h('span.muted', p.author) : null),
    h(
      'div.group',
      dirBtn,
      hasAnswers ? iconButton('check', 'Check', check, { text: true, title: 'Mark wrong letters' }) : null,
      hasAnswers ? iconButton('reveal', 'Reveal entry', () => reveal(false), { text: true }) : null,
      hasAnswers ? iconButton('revealAll', 'Reveal all', () => reveal(true), { text: true }) : null,
      iconButton('eraser', 'Clear', () => { fill.clear(); wrong.clear(); persist(); draw(); }, { text: true }),
      iconButton('fit', 'Fit to puzzle', () => view.fit(p.cells)),
    ),
    h(
      'div.group',
      opts.puzzle ? h('button.ghost', { onclick: () => go(`#/edit/${p.id}`) }, 'Back to editor') : h('button.ghost', { onclick: () => { const c = p; c.id = newPuzzle().id; c.created = c.modified = new Date().toISOString(); puzzleStore.put(c); toast('Saved to your library'); go(`#/edit/${c.id}`); } }, 'Save to library'),
      iconButton('download', 'Export', () => openExportDialog(p), { text: true, cls: 'primary' }),
    ),
  );
  mount(root, nav('solve'), toolbar, h('div.editor', h('div.stage', view.el), panel));
  requestAnimationFrame(() => { view.fit(p.cells); view.el.focus(); });

  function persist() {
    progressStore.put(hash, Object.fromEntries(fill));
  }
  function move(dr: number, dc: number) {
    // move to the next cell in that direction, skipping void
    let r = cursor.r + dr, c = cursor.c + dc;
    for (let i = 0; i < 50 && !p.cells.has(cellKey(r, c)); i++) (r += dr), (c += dc);
    if (p.cells.has(cellKey(r, c))) cursor = { r, c };
    view.reveal(cursor.r, cursor.c);
    draw();
  }
  function check() {
    wrong = new Set();
    for (const [k, l] of fill) if (l && p.cells.get(k)?.l && p.cells.get(k)!.l !== l) wrong.add(k);
    draw();
    if (!wrong.size) toast('No mistakes so far');
  }
  function reveal(all: boolean) {
    const slots = computeSlots(p.cells);
    const cells = all ? [...p.cells.values()].map((c) => [c.r, c.c] as [number, number]) : slotCells(slotThrough(slots, cursor.r, cursor.c, dir) ?? { r: cursor.r, c: cursor.c, dir, len: 1, number: 0 });
    for (const [r, c] of cells) {
      const l = p.cells.get(cellKey(r, c))?.l;
      if (l) fill.set(cellKey(r, c), l);
    }
    wrong.clear();
    persist();
    draw();
  }

  view.el.addEventListener('keydown', (e) => {
    const arrows: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (e.key in arrows) {
      e.preventDefault();
      const [dr, dc] = arrows[e.key];
      const want: Dir = dr ? 'D' : 'A';
      if (want !== dir) { dir = want; dirBtn.textContent = dir === 'A' ? 'Across' : 'Down'; draw(); }
      else move(dr, dc);
      return;
    }
    if (/^[a-zA-Z]$/.test(e.key) && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      const k = cellKey(cursor.r, cursor.c);
      if (!p.cells.has(k)) return;
      fill.set(k, e.key.toUpperCase());
      wrong.delete(k);
      persist();
      move(dir === 'A' ? 0 : 1, dir === 'A' ? 1 : 0);
      return;
    }
    if (e.key === 'Backspace') {
      e.preventDefault();
      const k = cellKey(cursor.r, cursor.c);
      if (fill.get(k)) { fill.delete(k); wrong.delete(k); persist(); draw(); }
      else move(dir === 'A' ? 0 : -1, dir === 'A' ? -1 : 0);
      return;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      dir = dir === 'A' ? 'D' : 'A';
      dirBtn.textContent = dir === 'A' ? 'Across' : 'Down';
      draw();
    }
  });
  view.onCellPointerDown = (r, c) => {
    if (!p.cells.has(cellKey(r, c))) return;
    if (cursor.r === r && cursor.c === c) dir = dir === 'A' ? 'D' : 'A';
    cursor = { r, c };
    dirBtn.textContent = dir === 'A' ? 'Across' : 'Down';
    draw();
  };

  function draw() {
    const slots = computeSlots(p.cells);
    const s = slotThrough(slots, cursor.r, cursor.c, dir);
    const ops = renderGrid(p.cells, {
      cellSize: view.S,
      theme,
      origin: { r: 0, c: 0 },
      cursor,
      slot: new Set(s ? slotCells(s).map(([r, c]) => cellKey(r, c)) : []),
      overlay: fill,
      wrong,
    });
    view.render(ops);
    clear(panel);
    const es = entries(p, slots);
    for (const d of ['A', 'D'] as const) {
      const list = h('div.clue-list');
      for (const e of es.filter((e) => e.dir === d)) {
        const active = s && s.r === e.r && s.c === e.c && s.dir === e.dir;
        list.append(
          h(
            'div.clue-row.readonly',
            { class: active ? 'clue-row readonly active' : 'clue-row readonly', onclick: () => { cursor = { r: e.r, c: e.c }; dir = e.dir; dirBtn.textContent = dir === 'A' ? 'Across' : 'Down'; view.reveal(e.r, e.c); draw(); } },
            h('span.num', String(e.number)),
            h('span.text', e.clue, ` (${enumFor(e)})`),
          ),
        );
      }
      panel.append(h('h3', d === 'A' ? 'Across' : 'Down'), list);
    }
  }
  draw();
}
