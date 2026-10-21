import { cellKey } from '../model/types';
import { Cells } from '../model/grid';
import { fromJSON, newPuzzle } from '../model/puzzle';
import { renderGrid } from '../render/grid';
import { opsToSvgInner } from '../render/svg';
import { layoutGridOnly } from '../render/page';
import { svgDocument } from '../render/svg';
import { bankStore, puzzleStore, settingsStore } from '../store/db';
import { applyChrome, currentFonts, currentTheme, go, mount, nav, openHelp } from './app';
import { h, svgEl } from './dom';
import { IconName, icon } from './icons';

export function homeScreen(root: HTMLElement) {
  const theme = currentTheme();
  const fonts = currentFonts();
  applyChrome(theme, fonts);

  // wordmark drawn as a row of cells by the grid renderer
  const word = 'CRYPTOGRAPHER';
  const cells: Cells = new Map();
  [...word].forEach((l, c) => cells.set(cellKey(0, c), { r: 0, c, l }));
  const S = 44;
  const ops = renderGrid(cells, { cellSize: S, theme, showNumbers: false });
  const mark = h('div.wordmark');
  mark.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-3 -3 ${word.length * S + 6} ${S + 6}" width="100%">${opsToSvgInner(ops, fonts)}</svg>`;

  const puzzles = puzzleStore.list();
  const bankCount = bankStore.list().length;

  const newPuzzleAction = () => {
    const p = newPuzzle();
    const s = settingsStore.get();
    p.theme = s.theme;
    p.fonts = s.fonts;
    p.author = s.author;
    puzzleStore.put(p);
    go(`#/edit/${p.id}`);
  };

  const tile = (name: IconName, label: string, sub: string, onclick: () => void, primary = false) =>
    h('button', { class: primary ? 'home-tile primary' : 'home-tile', onclick }, icon(name, 22), h('span.tile-label', label), h('span.tile-sub', sub));

  const recent = h('div.recent');
  for (const j of puzzles.slice(0, 4)) {
    const p = fromJSON(j);
    const showAnswers = !!settingsStore.get().showAnswers;
    const page = layoutGridOnly(p, theme, showAnswers, 16, theme.colors.page);
    const thumb = h('div.recent-thumb');
    if (p.cells.size) {
      const svg = svgEl(svgDocument(page.ops.filter((o) => o.kind !== 'text' || (showAnswers && o.role === 'answers')), page.w, page.h, fonts));
      svg.removeAttribute('width');
      svg.removeAttribute('height');
      thumb.append(svg);
    }
    recent.append(h('button.recent-card', { onclick: () => go(`#/edit/${p.id}`) }, thumb, h('span.recent-title', p.title || 'Untitled')));
  }

  mount(
    root,
    nav('home'),
    h(
      'main.home',
      h(
        'div.home-inner',
        mark,
        h('p.tagline', { hidden: true }), // tagline: Mark's copy
        h(
          'div.home-tiles',
          tile('plus', 'New puzzle', 'Start with an empty grid', newPuzzleAction, true),
          tile('grid', 'Library', puzzles.length === 1 ? '1 puzzle' : `${puzzles.length} puzzles`, () => go('#/library')),
          tile('bank', 'Clue bank', bankCount === 1 ? '1 clue' : `${bankCount} clues`, () => go('#/bank')),
        ),
        puzzles.length ? h('div.recent-wrap', h('h3', 'Recent'), recent) : null,
        h('div.home-foot', h('button.link', { onclick: () => openHelp() }, 'How to use Cryptographer'), h('a.link', { href: '#/settings' }, 'Settings')),
      ),
    ),
  );
}
