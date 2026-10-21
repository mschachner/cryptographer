import { Puzzle, PuzzleJSON, Theme } from '../model/types';
import { bounds } from '../model/grid';
import { entries, fromJSON, newPuzzle, toJSON } from '../model/puzzle';
import { decodePuzzle } from '../model/codec';
import { layoutGridOnly } from '../render/page';
import { svgDocument } from '../render/svg';
import { exportAll, importAll, puzzleStore, settingsStore } from '../store/db';
import { applyChrome, currentFonts, currentTheme, go, mount, nav } from './app';
import { download, h, popoverMenu, svgEl, toast } from './dom';
import { openExportDialog } from './exportDialog';
import { openShareDialog } from './shareDialog';
import { iconButton } from './icons';

export function libraryScreen(root: HTMLElement) {
  const theme = currentTheme();
  const fonts = currentFonts();
  applyChrome(theme, fonts);
  const search = h('input.search', { placeholder: 'Search', oninput: () => drawCards() }) as HTMLInputElement;
  const cards = h('div.cards');
  const fileIn = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: async () => { const f = fileIn.files?.[0]; if (!f) return; try { const n = importAll(await f.text()); toast(`Restored ${n.puzzles} puzzles and ${n.bank} bank entries`); drawCards(); } catch (e) { toast('That file could not be read'); } fileIn.value = ''; } }) as HTMLInputElement;
  const linkIn = h('input', { placeholder: 'Paste a share link', onkeydown: (e: KeyboardEvent) => { if (e.key === 'Enter') importLink(); } }) as HTMLInputElement;
  const importLink = () => {
    const m = /#p=([A-Za-z0-9_\-]+)/.exec(linkIn.value);
    if (!m) return toast('That is not a share link');
    try {
      const j = decodePuzzle(m[1]);
      j.id = newPuzzle().id;
      puzzleStore.putJSON(j);
      linkIn.value = '';
      drawCards();
    } catch {
      toast('Could not read that link');
    }
  };

  const toolbar = h(
    'div.toolbar',
    h('div.group', iconButton('plus', 'New puzzle', () => { const p = newPuzzle(); const s = settingsStore.get(); p.theme = s.theme; p.fonts = s.fonts; p.author = s.author; puzzleStore.put(p); go(`#/edit/${p.id}`); }, { text: true, cls: 'primary' }), search),
    h('div.group', linkIn, iconButton('link', 'Add from link', importLink, { text: true }), iconButton('download', 'Back up everything', () => download(new Blob([exportAll()], { type: 'application/json' }), 'cryptographer-backup.json'), { text: true }), iconButton('upload', 'Restore from backup', () => fileIn.click(), { text: true }), fileIn),
  );
  mount(root, nav('library'), toolbar, h('main.library', cards));
  drawCards();

  function drawCards() {
    cards.replaceChildren();
    const q = search.value.trim().toUpperCase();
    const list = puzzleStore.list().filter((j) => !q || (j.title || '').toUpperCase().includes(q) || answersOf(j).some((a) => a.includes(q)));
    if (!list.length) {
      cards.append(h('div.empty-slot', { hidden: true }));
      return;
    }
    for (const j of list) cards.append(card(j, theme));
  }

  function card(j: PuzzleJSON, th: Theme): HTMLElement {
    const p = fromJSON(j);
    const page = layoutGridOnly(p, th, false, 20, th.colors.page);
    const thumb = h('div.thumb');
    if (p.cells.size) {
      const svg = svgEl(svgDocument(page.ops.filter((o) => o.kind !== 'text'), page.w, page.h, fonts));
      svg.removeAttribute('width');
      svg.removeAttribute('height');
      thumb.append(svg);
    }
    const es = entriesCount(p);
    const menuBtn = h('button.icon.card-menu', { 'aria-label': 'More', onclick: (e: MouseEvent) => { e.stopPropagation(); popoverMenu(menuBtn, [
      { label: 'Share', onclick: () => openShareDialog(p) },
      { label: 'Export', onclick: () => openExportDialog(p) },
      { label: 'Duplicate', onclick: () => { const c = fromJSON(toJSON(p)); c.id = newPuzzle().id; c.title = p.title ? `${p.title} (copy)` : ''; c.created = c.modified = new Date().toISOString(); puzzleStore.put(c); drawCards(); } },
      { label: 'Delete', danger: true, onclick: () => { puzzleStore.delete(p.id); drawCards(); toast(`Deleted ${p.title || 'Untitled'}`, () => { puzzleStore.putJSON(j); drawCards(); }); } },
    ]); } });
    menuBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="3.5" cy="9" r="1.6" fill="currentColor"/><circle cx="9" cy="9" r="1.6" fill="currentColor"/><circle cx="14.5" cy="9" r="1.6" fill="currentColor"/></svg>';
    const el = h(
      'div.card',
      { onclick: (e: MouseEvent) => { if ((e.target as HTMLElement).closest('.card-menu')) return; go(`#/edit/${p.id}`); } },
      thumb,
      h('div.card-body', h('div.card-head', h('div.card-title', p.title || 'Untitled'), menuBtn), h('div.card-meta', `${dims(p)} · ${es.clued}/${es.entries} clued · ${new Date(p.modified).toLocaleDateString()}`)),
    );
    return el;
  }
}

function answersOf(j: PuzzleJSON): string[] {
  const p = fromJSON(j);
  return entries(p).map((e) => e.answer);
}

function dims(p: Puzzle): string {
  const b = bounds(p.cells);
  return b ? `${b.c1 - b.c0 + 1}×${b.r1 - b.r0 + 1}` : 'empty';
}

function entriesCount(p: Puzzle) {
  const es = entries(p);
  return { entries: es.length, clued: es.filter((e) => e.clue.trim()).length };
}
