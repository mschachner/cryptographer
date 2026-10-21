import { Cells, computeSlots, isolatedCells, rotate180, slotCells, slotThrough } from '../model/grid';
import { ClueText, Dir, Entry, Puzzle, cellKey, clueKey } from '../model/types';
import { clonePuzzle, entries, isComplete, reattachClues } from '../model/puzzle';
import { fitsPattern, makeBankEntry } from '../model/bank';
import { renderGrid } from '../render/grid';
import { bankStore, puzzleStore } from '../store/db';
import { applyChrome, currentFonts, currentTheme, go, mount, nav } from './app';
import { GridView } from './gridView';
import { h, clear, toast } from './dom';
import { openExportDialog } from './exportDialog';
import { openShareDialog } from './shareDialog';
import { iconButton } from './icons';

interface Sel {
  r0: number;
  c0: number;
  r1: number;
  c1: number;
}

export function editorScreen(root: HTMLElement, puzzle: Puzzle, bankTray: string[] = []) {
  const p = puzzle;
  let cursor = { r: 0, c: 0 };
  let dir: Dir = 'A';
  let symmetry = false;
  let sel: Sel | null = null;
  let selAnchor: { r: number; c: number } | null = null;
  const undo: Puzzle[] = [];
  const redo: Puzzle[] = [];
  let theme = currentTheme();
  let fonts = currentFonts();
  applyChrome(theme, fonts);

  const view = new GridView(fonts);
  const panel = h('aside.clue-panel');
  const tray = h('div.tray');
  const titleInput = h('input.title', { value: p.title, placeholder: 'Title', oninput: () => { p.title = titleInput.value; save(); } }) as HTMLInputElement;
  const dirBtn = h('button.ghost', { onclick: () => setDir(dir === 'A' ? 'D' : 'A'), title: 'Toggle direction (Enter)' }, 'Across');
  const symBtn = iconButton('symmetry', 'Symmetry', () => { symmetry = !symmetry; symBtn.classList.toggle('on', symmetry); view.el.focus(); }, { text: true, title: 'Mirror changes through the center' });

  const toolbar = h(
    'div.toolbar',
    h('div.group', titleInput),
    h(
      'div.group',
      dirBtn,
      symBtn,
      iconButton('undo', 'Undo', () => doUndo(), { title: 'Undo (⌘Z)', disabled: true, id: 'undo' }),
      iconButton('redo', 'Redo', () => doRedo(), { title: 'Redo (⇧⌘Z)', disabled: true, id: 'redo' }),
      iconButton('fit', 'Fit to puzzle', () => view.fit(p.cells)),
      iconButton('zoomOut', 'Zoom out', () => view.zoomBy(1 / 1.25)),
      iconButton('zoomIn', 'Zoom in', () => view.zoomBy(1.25)),
    ),
    h(
      'div.group',
      iconButton('eye', 'Preview', () => go(`#/preview/${p.id}`), { text: true, title: 'See the puzzle as a solver' }),
      iconButton('share', 'Share', () => openShareDialog(p), { text: true }),
      iconButton('download', 'Export', () => openExportDialog(p), { text: true, cls: 'primary' }),
    ),
  );
  const undoBtn = toolbar.querySelector('#undo') as HTMLButtonElement;
  const redoBtn = toolbar.querySelector('#redo') as HTMLButtonElement;

  const status = h('div.status');
  const main = h('div.editor', h('div.stage', view.el, status, tray), panel);
  mount(root, nav('edit'), toolbar, main);
  requestAnimationFrame(() => {
    view.fit(p.cells);
    view.el.focus();
  });

  // ---- persistence & history ----
  let saveTimer: number | undefined;
  function save() {
    p.modified = new Date().toISOString();
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => puzzleStore.put(p), 250);
    const crumb = root.querySelector('.crumb');
    if (crumb) crumb.textContent = p.title || 'Untitled';
  }
  function snapshot() {
    undo.push(clonePuzzle(p));
    if (undo.length > 200) undo.shift();
    redo.length = 0;
    undoBtn.disabled = false;
    redoBtn.disabled = true;
  }
  function restore(from: Puzzle) {
    p.cells = from.cells;
    p.clues = from.clues;
    p.orphans = from.orphans;
    p.title = from.title;
    titleInput.value = p.title;
  }
  function doUndo() {
    const s = undo.pop();
    if (!s) return;
    redo.push(clonePuzzle(p));
    restore(s);
    undoBtn.disabled = undo.length === 0;
    redoBtn.disabled = false;
    save();
    draw();
  }
  function doRedo() {
    const s = redo.pop();
    if (!s) return;
    undo.push(clonePuzzle(p));
    restore(s);
    redoBtn.disabled = redo.length === 0;
    undoBtn.disabled = false;
    save();
    draw();
  }
  /** Run a grid mutation as one undo step, reattaching clues afterwards. */
  function commit(fn: () => void) {
    const oldSlots = computeSlots(p.cells);
    const oldCells: Cells = new Map(p.cells);
    snapshot();
    fn();
    reattachClues(p, oldSlots, oldCells);
    save();
    draw();
  }

  // ---- grid mutations ----
  function setCell(r: number, c: number, on: boolean) {
    const k = cellKey(r, c);
    if (on) {
      if (!p.cells.has(k)) p.cells.set(k, { r, c, l: '' });
    } else p.cells.delete(k);
    if (symmetry) {
      const [rr, cc] = rotate180(p.cells, r, c);
      const kk = cellKey(rr, cc);
      if (on && !p.cells.has(kk)) p.cells.set(kk, { r: rr, c: cc, l: '' });
      if (!on) p.cells.delete(kk);
    }
  }
  function typeLetter(ch: string) {
    commit(() => {
      const k = cellKey(cursor.r, cursor.c);
      const cell = p.cells.get(k);
      if (cell) cell.l = ch;
      else {
        setCell(cursor.r, cursor.c, true);
        p.cells.get(k)!.l = ch;
      }
    });
    move(dir === 'A' ? 0 : 1, dir === 'A' ? 1 : 0, false);
  }
  function backspace() {
    const k = cellKey(cursor.r, cursor.c);
    const cell = p.cells.get(k);
    if (cell?.l) {
      commit(() => (cell.l = ''));
      return;
    }
    if (cell) commit(() => setCell(cursor.r, cursor.c, false));
    move(dir === 'A' ? 0 : -1, dir === 'A' ? -1 : 0, false);
  }
  function move(dr: number, dc: number, switchDir = true) {
    if (switchDir) {
      const wantDir: Dir = dr !== 0 ? 'D' : 'A';
      if (wantDir !== dir) {
        setDir(wantDir);
        return;
      }
    }
    cursor = { r: cursor.r + dr, c: cursor.c + dc };
    sel = null;
    view.reveal(cursor.r, cursor.c);
    draw();
  }
  function setDir(d: Dir) {
    dir = d;
    dirBtn.textContent = d === 'A' ? 'Across' : 'Down';
    draw();
  }
  function forSelection(fn: (r: number, c: number) => void) {
    if (!sel) return fn(cursor.r, cursor.c);
    for (let r = Math.min(sel.r0, sel.r1); r <= Math.max(sel.r0, sel.r1); r++)
      for (let c = Math.min(sel.c0, sel.c1); c <= Math.max(sel.c0, sel.c1); c++) fn(r, c);
  }
  function toggleCells() {
    const anyOn = (() => {
      let on = false;
      forSelection((r, c) => { if (p.cells.has(cellKey(r, c))) on = true; });
      return on;
    })();
    commit(() => forSelection((r, c) => setCell(r, c, sel ? !anyOn : !p.cells.has(cellKey(r, c)))));
  }

  // ---- keyboard ----
  view.el.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      e.shiftKey ? doRedo() : doUndo();
      return;
    }
    if (mod) return;
    const arrows: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (e.key in arrows) {
      e.preventDefault();
      const [dr, dc] = arrows[e.key];
      if (e.shiftKey) {
        if (!sel) sel = { r0: cursor.r, c0: cursor.c, r1: cursor.r, c1: cursor.c };
        sel = { ...sel, r1: sel.r1 + dr, c1: sel.c1 + dc };
        cursor = { r: sel.r1, c: sel.c1 };
        view.reveal(cursor.r, cursor.c);
        draw();
      } else move(dr, dc);
      return;
    }
    if (/^[a-zA-Z]$/.test(e.key)) {
      e.preventDefault();
      if (!sel) typeLetter(e.key.toUpperCase());
      return;
    }
    switch (e.key) {
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        setDir(dir === 'A' ? 'D' : 'A');
        break;
      case 'Backspace':
        e.preventDefault();
        if (sel) commit(() => forSelection((r, c) => setCell(r, c, false)));
        else backspace();
        break;
      case 'Delete':
        e.preventDefault();
        commit(() => forSelection((r, c) => setCell(r, c, false)));
        break;
      case ' ':
        e.preventDefault();
        toggleCells();
        break;
      case 'Escape':
        sel = null;
        draw();
        break;
    }
  });

  // ---- pointer ----
  view.onCellPointerDown = (r, c, e) => {
    if (e.shiftKey) {
      selAnchor = { r, c };
      sel = { r0: r, c0: c, r1: r, c1: c };
      cursor = { r, c };
      draw();
      return;
    }
    if (cursor.r === r && cursor.c === c && !sel) setDir(dir === 'A' ? 'D' : 'A');
    else {
      cursor = { r, c };
      sel = null;
      draw();
    }
  };
  view.onCellPointerMove = (r, c) => {
    if (!selAnchor) return;
    sel = { r0: selAnchor.r, c0: selAnchor.c, r1: r, c1: c };
    cursor = { r, c };
    draw();
  };
  view.onPointerUp = () => {
    selAnchor = null;
  };

  // ---- drawing ----
  function currentSlotKeys(slots = computeSlots(p.cells)): Set<string> {
    const s = slotThrough(slots, cursor.r, cursor.c, dir);
    return new Set(s ? slotCells(s).map(([r, c]) => cellKey(r, c)) : []);
  }
  function draw() {
    const slots = computeSlots(p.cells);
    const ops = renderGrid(p.cells, {
      cellSize: view.S,
      theme,
      origin: { r: 0, c: 0 },
      cursor,
      slot: currentSlotKeys(slots),
      isolated: isolatedCells(p.cells, slots),
    });
    // cursor outline on void squares and the selection rectangle
    const S = view.S;
    if (!p.cells.has(cellKey(cursor.r, cursor.c)))
      ops.push({ kind: 'path', d: `M${cursor.c * S},${cursor.r * S}h${S}v${S}h${-S}Z`, fill: theme.colors.accent + '55', stroke: theme.colors.accent, strokeWidth: 2 });
    if (sel) {
      const r0 = Math.min(sel.r0, sel.r1), c0 = Math.min(sel.c0, sel.c1);
      const r1 = Math.max(sel.r0, sel.r1), c1 = Math.max(sel.c0, sel.c1);
      ops.push({ kind: 'path', d: `M${c0 * S},${r0 * S}h${(c1 - c0 + 1) * S}v${(r1 - r0 + 1) * S}h${-(c1 - c0 + 1) * S}Z`, fill: theme.colors.accent + '33', stroke: theme.colors.accent, strokeWidth: 2, dash: [6, 4] });
    }
    view.render(ops);
    drawPanel(slots);
    const c = isComplete(p);
    status.textContent = `${p.cells.size} cells · ${c.entries} entries · ${c.clued} clued` + (c.empty ? ` · ${c.empty} empty` : '');
  }

  // ---- clue panel ----
  let focusedClue: string | null = null;
  function drawPanel(slots = computeSlots(p.cells)) {
    const active = document.activeElement;
    if (active && panel.contains(active) && (active as HTMLElement).dataset.key) focusedClue = (active as HTMLElement).dataset.key! + ':' + (active as HTMLElement).dataset.field;
    else focusedClue = null;
    const caret = active instanceof HTMLInputElement ? active.selectionStart : null;
    clear(panel);
    const es = entries(p, slots);
    const cur = slotThrough(slots, cursor.r, cursor.c, dir);
    const curKey = cur ? clueKey(cur.r, cur.c, cur.dir) : null;

    for (const d of ['A', 'D'] as const) {
      const list = h('div.clue-list');
      for (const e of es.filter((e) => e.dir === d)) list.append(clueRow(e, curKey === clueKey(e.r, e.c, e.dir)));
      panel.append(h('h3', d === 'A' ? 'Across' : 'Down'), list);
    }
    if (p.orphans.length) {
      const list = h('div.clue-list.orphans');
      p.orphans.forEach((o, i) =>
        list.append(
          h(
            'div.clue-row.orphan',
            h('span.num', o.dir),
            h('span.answer', o.answer),
            h('span.text', o.clue, o.enum ? ` (${o.enum})` : ''),
            h('button.link', { onclick: () => { bankClue(o.answer.replace(/\?/g, ''), o); p.orphans.splice(i, 1); save(); draw(); } }, 'Bank'),
            h('button.link', { onclick: () => { p.orphans.splice(i, 1); save(); draw(); } }, 'Delete'),
          ),
        ),
      );
      panel.append(h('h3', 'Orphaned clues'), list);
    }
    if (cur) panel.append(suggestions(cur, es));
    panel.append(
      h(
        'div.panel-actions',
        iconButton('bank', 'Bank all clues', () => { let n = 0; for (const e of es) if (e.clue.trim()) (bankClue(e.answer.replace(/·/g, ''), e), n++); toast(`${n} banked`); draw(); }, { text: true }),
      ),
    );
    if (focusedClue) {
      const [key, field] = focusedClue.split(':');
      const el = (panel as HTMLElement).querySelector<HTMLInputElement>(`[data-key="${key}"][data-field="${field}"]`);
      if (el) {
        el.focus();
        if (caret !== null && caret !== undefined) el.setSelectionRange(caret, caret);
      }
    }
    drawTray();
  }

  function clueRow(e: Entry, active: boolean): HTMLElement {
    const key = clueKey(e.r, e.c, e.dir);
    const text = p.clues.get(key) ?? { clue: '', enum: '' };
    const setText = (t: Partial<ClueText>) => {
      const cur = p.clues.get(key) ?? { clue: '', enum: '' };
      p.clues.set(key, { ...cur, ...t });
      save();
    };
    const clueIn = h('input.clue', { value: text.clue, placeholder: '', dataset: { key, field: 'clue' }, oninput: () => setText({ clue: clueIn.value }) }) as HTMLInputElement;
    const enumIn = h('input.enum', { value: text.enum, placeholder: String(e.len), dataset: { key, field: 'enum' }, oninput: () => { enumIn.value = enumIn.value.replace(/[^0-9,'\-]/g, ''); setText({ enum: enumIn.value }); } }) as HTMLInputElement;
    const row = h(
      'div.clue-row',
      { class: active ? 'clue-row active' : 'clue-row' },
      h('button.num', { onclick: () => { cursor = { r: e.r, c: e.c }; dir = e.dir; dirBtn.textContent = dir === 'A' ? 'Across' : 'Down'; view.reveal(e.r, e.c); draw(); } }, String(e.number)),
      h('span.answer', e.answer),
      h('div.clue-line', clueIn, h('span.paren', '(', enumIn, ')')),
      iconButton(bankStore.byAnswer(e.answer) ? 'banked' : 'bank', 'Bank this clue', () => { if (!e.answer.includes('·')) { bankClue(e.answer, { ...text, enum: text.enum || String(e.len) }); toast(`Banked ${e.answer}`); draw(); } }, { cls: 'icon-link' }),
    );
    return row;
  }

  function bankClue(answer: string, t: ClueText) {
    if (!answer) return;
    const existing = bankStore.byAnswer(answer);
    const entry = makeBankEntry({ ...(existing ?? {}), answer, clue: t.clue, enum: t.enum, usedIn: [...new Set([...(existing?.usedIn ?? []), p.id])] });
    bankStore.put(entry);
  }

  function suggestions(cur: Entry | ReturnType<typeof computeSlots>[number], es: Entry[]): HTMLElement {
    const entry = es.find((e) => e.r === cur.r && e.c === cur.c && e.dir === cur.dir)!;
    const pattern = entry.answer;
    const matches = bankStore.list().filter((b) => fitsPattern(b.answer, pattern) && b.answer !== pattern);
    const box = h('div.suggestions');
    if (!matches.length) return box;
    box.append(h('h3', `Bank matches for ${entry.number}${entry.dir}`));
    for (const b of matches.slice(0, 12)) {
      const used = b.usedIn.filter((id) => id !== p.id).length > 0;
      box.append(
        h(
          'button.suggestion',
          { class: used ? 'suggestion used' : 'suggestion', onclick: () => placeFromBank(b.answer, b.clue, b.enum, cur.r, cur.c, cur.dir) },
          h('span.answer', b.answer),
          h('span.text', b.clue, b.enum ? ` (${b.enum})` : ''),
          used ? h('span.tag', 'used') : null,
        ),
      );
    }
    return box;
  }

  function placeFromBank(answer: string, clue: string, en: string, r: number, c: number, d: Dir) {
    commit(() => {
      for (let i = 0; i < answer.length; i++) {
        const rr = d === 'A' ? r : r + i, cc = d === 'A' ? c + i : c;
        setCell(rr, cc, true);
        p.cells.get(cellKey(rr, cc))!.l = answer[i];
      }
    });
    p.clues.set(clueKey(r, c, d), { clue, enum: en });
    const b = bankStore.byAnswer(answer);
    if (b && !b.usedIn.includes(p.id)) bankStore.put({ ...b, usedIn: [...b.usedIn, p.id] });
    save();
    draw();
  }

  // ---- bank tray (new puzzle from bank selection) ----
  function drawTray() {
    clear(tray);
    if (!bankTray.length) {
      tray.hidden = true;
      return;
    }
    tray.hidden = false;
    const all = bankStore.list();
    tray.append(h('h3', 'From bank'));
    for (const id of bankTray) {
      const b = all.find((x) => x.id === id);
      if (!b) continue;
      tray.append(
        h(
          'button.suggestion',
          { title: 'Place at the cursor in the current direction', onclick: () => { placeFromBank(b.answer, b.clue, b.enum, cursor.r, cursor.c, dir); bankTray = bankTray.filter((x) => x !== id); drawTray(); } },
          h('span.answer', b.answer),
          h('span.text', b.clue),
        ),
      );
    }
  }

  draw();
  return { refreshTheme: () => { theme = currentTheme(); fonts = currentFonts(); view.setFonts(fonts); applyChrome(theme, fonts); draw(); } };
}
