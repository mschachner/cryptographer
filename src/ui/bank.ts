import { BankEntry } from '../model/types';
import { enumFromSpelling, fitsPattern, makeBankEntry, normalizeAnswer } from '../model/bank';
import { newPuzzle } from '../model/puzzle';
import { bankStore, puzzleStore, settingsStore } from '../store/db';
import { applyChrome, currentFonts, currentTheme, go, mount, nav } from './app';
import { download, h, toast } from './dom';
import { iconButton } from './icons';

export function bankScreen(root: HTMLElement) {
  applyChrome(currentTheme(), currentFonts());
  const selected = new Set<string>();
  const search = h('input.search.bank-search', { placeholder: 'Search or pattern (S?A??)', oninput: () => drawTable() }) as HTMLInputElement;
  const table = h('div.bank-table');

  // add form
  const ansIn = h('input', { placeholder: 'Answer', onkeydown: (e: KeyboardEvent) => { if (e.key === 'Enter') add(); } }) as HTMLInputElement;
  const clueIn = h('input.wide', { placeholder: 'Clue', onkeydown: (e: KeyboardEvent) => { if (e.key === 'Enter') add(); } }) as HTMLInputElement;
  const enumIn = h('input.enum', { placeholder: 'Lengths' }) as HTMLInputElement;
  const add = () => {
    const answer = normalizeAnswer(ansIn.value);
    if (!answer) return;
    const existing = bankStore.byAnswer(answer);
    const en = enumIn.value || (/[\s-]/.test(ansIn.value.trim()) ? enumFromSpelling(ansIn.value) : '');
    bankStore.put(makeBankEntry({ ...(existing ?? {}), answer, clue: clueIn.value, enum: en }));
    ansIn.value = clueIn.value = enumIn.value = '';
    ansIn.focus();
    drawTable();
  };
  const fileIn = h('input', { type: 'file', accept: '.json', hidden: true, onchange: async () => { const f = fileIn.files?.[0]; if (!f) return; try { const o = JSON.parse(await f.text()); const list: BankEntry[] = Array.isArray(o) ? o : o.bank ?? []; let n = 0; for (const e of list) if (e.answer) (bankStore.put(makeBankEntry(e)), n++); toast(`Added ${n} entries`); drawTable(); } catch { toast('That file could not be read'); } fileIn.value = ''; } }) as HTMLInputElement;

  const newFromSel = h('button.primary', { disabled: true, onclick: () => { const p = newPuzzle(); const s = settingsStore.get(); p.theme = s.theme; p.fonts = s.fonts; p.author = s.author; puzzleStore.put(p); sessionStorage.setItem('cryptographer.tray', JSON.stringify([...selected])); go(`#/edit/${p.id}`); } }, 'New puzzle from selection');

  const toolbar = h(
    'div.toolbar',
    h('div.group', ansIn, clueIn, h('span.paren', '(', enumIn, ')'), h('button.ghost', { onclick: add }, 'Add')),
    h('div.group', search, newFromSel, iconButton('download', 'Save bank to file', () => download(new Blob([JSON.stringify(bankStore.list(), null, 1)], { type: 'application/json' }), 'clue-bank.json'), { text: true }), iconButton('upload', 'Load bank from file', () => fileIn.click(), { text: true }), fileIn),
  );
  mount(root, nav('bank'), toolbar, h('main.bank', table));
  drawTable();

  function drawTable() {
    table.replaceChildren();
    const q = search.value.trim().toUpperCase();
    const isPattern = /^[A-Z?·]+$/.test(q) && q.includes('?');
    const list = bankStore
      .list()
      .filter((e) => !q || (isPattern ? fitsPattern(e.answer, q) : e.answer.includes(q) || e.clue.toUpperCase().includes(q) || e.tags.some((t) => t.toUpperCase().includes(q))))
      .sort((a, b) => a.answer.localeCompare(b.answer));
    const head = h('div.bank-row.head', h('span'), h('span', 'Answer'), h('span', 'Clue'), h('span', 'Lengths'), h('span', 'Tags'), h('span', 'Used'), h('span'));
    table.append(head);
    if (!list.length) {
      table.append(h('div.empty-slot', { hidden: true }));
      return;
    }
    for (const e of list) table.append(row(e));
    newFromSel.disabled = selected.size === 0;
  }

  function row(e: BankEntry): HTMLElement {
    const save = (patch: Partial<BankEntry>) => bankStore.put({ ...e, ...patch });
    const chk = h('input', { type: 'checkbox', checked: selected.has(e.id), onchange: () => { chk.checked ? selected.add(e.id) : selected.delete(e.id); newFromSel.disabled = selected.size === 0; } }) as HTMLInputElement;
    const clue = h('input', { value: e.clue, oninput: () => save({ clue: clue.value }) }) as HTMLInputElement;
    const en = h('input.enum', { value: e.enum, placeholder: String(e.answer.length), oninput: () => { en.value = en.value.replace(/[^0-9,'\-]/g, ''); save({ enum: en.value }); } }) as HTMLInputElement;
    const tags = h('input', { value: e.tags.join(', '), oninput: () => save({ tags: tags.value.split(',').map((t) => t.trim()).filter(Boolean) }) }) as HTMLInputElement;
    return h(
      'div.bank-row',
      chk,
      h('span.answer', e.answer),
      clue,
      en,
      tags,
      h('span.muted', e.usedIn.length ? String(e.usedIn.length) : ''),
      iconButton('trash', 'Delete', () => { bankStore.delete(e.id); drawTable(); toast(`Deleted ${e.answer}`, () => { bankStore.put(e); drawTable(); }); }, { cls: 'icon-link' }),
    );
  }
}
