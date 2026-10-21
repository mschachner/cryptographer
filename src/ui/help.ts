import { Cells, computeSlots, slotCells } from '../model/grid';
import { FontSet, Theme, cellKey } from '../model/types';
import { renderGrid } from '../render/grid';
import { opsToSvgInner } from '../render/svg';
import { Op } from '../render/ops';
import { h } from './dom';

/** A small grid drawn with the live theme, from an ASCII picture ('.' = void, '_' = empty cell). */
function pic(
  theme: Theme,
  fonts: FontSet,
  rows: string[],
  o: { cursor?: [number, number]; dir?: 'A' | 'D'; cursorVoid?: boolean; S?: number; numbers?: boolean } = {},
): HTMLElement {
  const cells: Cells = new Map();
  rows.forEach((row, r) => [...row].forEach((ch, c) => { if (ch !== '.') cells.set(cellKey(r, c), { r, c, l: ch === '_' ? '' : ch }); }));
  const S = o.S ?? 34;
  const slots = computeSlots(cells);
  let slot: Set<string> | undefined;
  if (o.cursor && o.dir) {
    const [r, c] = o.cursor;
    const s = slots.find((s) => s.dir === o.dir && slotCells(s).some(([rr, cc]) => rr === r && cc === c));
    if (s) slot = new Set(slotCells(s).map(([r, c]) => cellKey(r, c)));
  }
  const ops: Op[] = renderGrid(cells, { cellSize: S, theme, origin: { r: 0, c: 0 }, cursor: o.cursor ? { r: o.cursor[0], c: o.cursor[1] } : null, slot, showNumbers: o.numbers ?? true });
  if (o.cursor && o.cursorVoid) {
    const [r, c] = o.cursor;
    ops.push({ kind: 'path', d: `M${c * S},${r * S}h${S}v${S}h${-S}Z`, fill: theme.colors.accent + '55', stroke: theme.colors.accent, strokeWidth: 2 });
  }
  const w = Math.max(...rows.map((r) => r.length)) * S, hgt = rows.length * S;
  const el = h('div.help-pic');
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 ${w + 8} ${hgt + 8}" width="${w + 8}" height="${hgt + 8}">${opsToSvgInner(ops, fonts)}</svg>`;
  return el;
}

function section(title: string, ...body: (HTMLElement | string)[]): HTMLElement {
  return h('section.help-section', h('h3', title), ...body);
}
const p = (...c: (HTMLElement | string)[]) => h('p', ...c);
const kbd = (k: string) => h('kbd', k);
const fig = (image: HTMLElement, caption: string) => h('figure', image, h('figcaption', caption));
const row = (...figs: HTMLElement[]) => h('div.help-row', ...figs);

type Row = [action: HTMLElement | string, effect: HTMLElement | string];
const legend = (rows: Row[]) => h('table.legend', ...rows.map(([a, e]) => h('tr', h('td.action', a), h('td', e))));

export function helpContent(theme: Theme, fonts: FontSet): HTMLElement {
  const titles = ['Building a grid', 'Numbers and clues', 'Library', 'Clue bank', 'Sharing', 'Exporting'];
  const toc = h(
    'nav.help-toc',
    ...titles.map((t, i) =>
      h('a', { href: `#help-${i}`, onclick: (e: Event) => { e.preventDefault(); document.getElementById(`help-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, t),
    ),
  );

  const s0 = section(
    'Building a grid',
    p('Click a square and type. Each letter fills the square under the cursor and creates the cell if it was empty. Empty squares serve as the black squares of a printed grid.'),
    row(
      fig(pic(theme, fonts, ['STAR.'], { cursor: [0, 4], dir: 'A', cursorVoid: true }), 'After typing S, T, A, R.'),
      fig(pic(theme, fonts, ['STARS', 'O....', 'F....', 'A....'], { cursor: [0, 0], dir: 'A' }), 'Across: the tinted squares are the current entry.'),
      fig(pic(theme, fonts, ['STARS', 'O....', 'F....', 'A....'], { cursor: [0, 0], dir: 'D' }), 'Down.'),
      fig(pic(theme, fonts, ['CAT', '_._', 'OWL'], { cursor: [1, 1], dir: 'A', cursorVoid: true }), 'A cell with no letter shows a dot.'),
    ),
    legend([
      [kbd('A to Z'), 'Type a letter and advance'],
      [h('span', kbd('Enter'), ' ', kbd('Tab'), ' or click the cursor square'), 'Switch between across and down'],
      [kbd('Arrows'), 'Move; at right angles to the current direction, switch direction instead'],
      [kbd('Space'), 'Turn a square into a cell, or back into empty space'],
      [kbd('Backspace'), 'Clear the letter; on an empty cell, remove it and step back'],
      [kbd('Delete'), 'Remove the cell'],
      [h('span', kbd('Shift'), ' + arrows or drag'), 'Select a rectangle; Space and Delete then apply to all of it'],
      [kbd('Esc'), 'Clear the selection'],
      [h('span', kbd('⌘Z'), ' ', kbd('⇧⌘Z')), 'Undo, redo'],
      ['Symmetry', 'Mirror every cell you add or remove through the center of the puzzle'],
      ['Drag or scroll', 'Pan'],
      [h('span', kbd('⌘'), ' + scroll'), 'Zoom'],
      ['Fit', 'Frame the puzzle'],
    ]),
  );

  const s1 = section(
    'Numbers and clues',
    p('Numbering is automatic. A square is numbered when it starts an across or down entry of two or more letters, in reading order. A square that starts both entries gets one number. Clues stay with their entry when the numbering changes.'),
    row(fig(pic(theme, fonts, ['BRASS', 'L.R.T', 'UNITE', 'E.S.E', 'STEAL'], {}), '1 starts 1 across and 1 down.')),
    legend([
      ['Entry number', 'Click to move the cursor to that entry'],
      ['Clue field', 'The clue text'],
      ['Bracketed field', 'The enumeration: word lengths such as 5,4 or 3-6. Defaults to the entry length'],
      ['Bookmark button', 'Send the answer and clue to the bank'],
      ['Orphaned clues', 'Clues whose entry was removed. Delete them or send them to the bank'],
      ['Dashed cell', 'A cell that belongs to no entry'],
    ]),
  );

  const s2 = section(
    'Library',
    legend([
      ['Auto-save', 'Every puzzle is saved in this browser as you work'],
      ['Card menu', 'Share, export, duplicate or delete a puzzle'],
      ['Back up everything', 'A file with all puzzles, the clue bank and themes'],
      ['Restore from backup', 'Load that file, for example on another computer'],
      ['Paste a share link', 'Add a single puzzle'],
    ]),
  );

  const s3 = section(
    'Clue bank',
    p("The bank stores all the clues you've written, independently of any puzzle."),
    legend([
      ['Add (Bank page)', 'A new entry. Spaces or hyphens in the answer fill in the enumeration'],
      ['Bookmark button (editor)', "Send an entry's answer and clue to the bank"],
      ['Bank matches (editor panel)', 'Bank entries that fit the current entry. Click one to place the answer and its clue'],
      ['New puzzle from selection', 'Start a puzzle with the selected answers in a tray; click an answer to place it at the cursor'],
      ['Search', 'Text, or a pattern: S?A?? matches five-letter answers with S first and A third'],
    ]),
  );

  const s4 = section(
    'Sharing',
    legend([
      ['Share', 'A link that contains the whole puzzle. Nothing is uploaded and the link does not expire'],
      ['Include answers', 'On: the solving view has Check and Reveal. Off: grid and clues only'],
      ['Opening a link', 'A solving view. Progress is saved in the browser; Save to library keeps a copy'],
    ]),
  );

  const s5 = section(
    'Exporting',
    legend([
      ['Format', 'PDF, PNG or JPEG image, or an SVG drawing of the grid'],
      ['Letters', 'Blank for solving, or filled in as an answer key'],
      ['Theme', 'Any theme. Print (black and white) gives white cells, black outlines and black blocks'],
      ['Orientation', 'Portrait or landscape'],
      ['Details', 'Title, author and date printed on the page'],
    ]),
  );

  const sections = [s0, s1, s2, s3, s4, s5];
  sections.forEach((s, i) => (s.id = `help-${i}`));
  return h('div.help', toc, ...sections);
}
