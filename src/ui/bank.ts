import { BankEntry } from '../model/types';
import { enumFromSpelling, fitsPattern, makeBankEntry, normalizeAnswer } from '../model/bank';
import { newPuzzle } from '../model/puzzle';
import { bankStore, puzzleStore, settingsStore } from '../store/db';
import { applyChrome, currentFonts, currentTheme, go, mount, nav } from './app';
import { download, h, toast } from './dom';
import { iconButton } from './icons';

type SortKey = 'answer' | 'length' | 'clue' | 'tags' | 'added' | 'used';
const COLUMNS: Array<[SortKey, string]> = [
  ['answer', 'Answer'],
  ['clue', 'Clue'],
  ['length', 'Lengths'],
  ['tags', 'Tags'],
  ['added', 'Added'],
  ['used', 'Used'],
];

export function bankScreen(root: HTMLElement) {
  applyChrome(currentTheme(), currentFonts());
  const selected = new Set<string>();
  let sortKey: SortKey = 'answer';
  let sortAsc = true;
  const search = h('input.search.bank-search', { placeholder: 'Search or pattern (S?A??)', oninput: () => drawTable() }) as HTMLInputElement;
  const table = h('div.bank-table');

  // ---- add form ----
  const onEnter = (e: KeyboardEvent) => { if (e.key === 'Enter') add(); };
  const ansIn = h('input', { placeholder: 'Answer', onkeydown: onEnter }) as HTMLInputElement;
  const clueIn = h('input.wide', { placeholder: 'Clue', onkeydown: onEnter }) as HTMLInputElement;
  const enumIn = h('input.enum.derived', { placeholder: 'Lengths', onkeydown: onEnter }) as HTMLInputElement;
  const tagsIn = h('input.tags', { placeholder: 'Tags', onkeydown: onEnter }) as HTMLInputElement;
  let enumEdited = false;
  // the enumeration follows the answer as it is typed, until it is edited by hand
  ansIn.oninput = () => { if (!enumEdited) enumIn.value = enumFromSpelling(ansIn.value); };
  enumIn.oninput = () => { enumIn.value = enumIn.value.replace(/[^0-9,'\-]/g, ''); enumEdited = enumIn.value !== ''; enumIn.classList.toggle('derived', !enumEdited); };
  const add = () => {
    const answer = normalizeAnswer(ansIn.value);
    if (!answer) return;
    const existing = bankStore.byAnswer(answer);
    const en = enumIn.value || enumFromSpelling(ansIn.value);
    const tags = tagsIn.value.split(',').map((t) => t.trim()).filter(Boolean);
    bankStore.put(makeBankEntry({ ...(existing ?? {}), answer, clue: clueIn.value, enum: en === String(answer.length) ? '' : en, tags: [...new Set([...(existing?.tags ?? []), ...tags])] }));
    ansIn.value = clueIn.value = enumIn.value = tagsIn.value = '';
    enumEdited = false;
    enumIn.classList.add('derived');
    ansIn.focus();
    drawTable();
  };
  const fileIn = h('input', { type: 'file', accept: '.json', hidden: true, onchange: async () => { const f = fileIn.files?.[0]; if (!f) return; try { const o = JSON.parse(await f.text()); const list: BankEntry[] = Array.isArray(o) ? o : o.bank ?? []; let n = 0; for (const e of list) if (e.answer) (bankStore.put(makeBankEntry(e)), n++); toast(`Added ${n} entries`); drawTable(); } catch { toast('That file could not be read'); } fileIn.value = ''; } }) as HTMLInputElement;

  const newFromSel = h('button.primary', { disabled: true, onclick: () => { const p = newPuzzle(); const s = settingsStore.get(); p.theme = s.theme; p.fonts = s.fonts; p.author = s.author; puzzleStore.put(p); sessionStorage.setItem('cryptographer.tray', JSON.stringify([...selected])); go(`#/edit/${p.id}`); } }, 'New puzzle from selection');

  const toolbar = h(
    'div.toolbar',
    h('div.group', ansIn, clueIn, h('span.paren', '(', enumIn, ')'), tagsIn, iconButton('plus', 'Add', add, { text: true })),
    h('div.group', search, newFromSel, iconButton('download', 'Save bank to file', () => download(new Blob([JSON.stringify(bankStore.list(), null, 1)], { type: 'application/json' }), 'clue-bank.json'), { text: true }), iconButton('upload', 'Load bank from file', () => fileIn.click(), { text: true }), fileIn),
  );
  mount(root, nav('bank'), toolbar, h('main.bank', table));
  drawTable();

  function sortValue(e: BankEntry, key: SortKey): string | number {
    switch (key) {
      case 'answer': return e.answer;
      case 'length': return e.answer.length;
      case 'clue': return e.clue.toLowerCase();
      case 'tags': return e.tags.join(', ').toLowerCase();
      case 'added': return e.created;
      case 'used': return e.usedIn.length;
    }
  }

  function drawTable() {
    table.replaceChildren();
    const q = search.value.trim().toUpperCase();
    const isPattern = /^[A-Z?·]+$/.test(q) && q.includes('?');
    const list = bankStore
      .list()
      .filter((e) => !q || (isPattern ? fitsPattern(e.answer, q) : e.answer.includes(q) || e.clue.toUpperCase().includes(q) || e.tags.some((t) => t.toUpperCase().includes(q))))
      .sort((a, b) => {
        const va = sortValue(a, sortKey), vb = sortValue(b, sortKey);
        const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
        return (sortAsc ? cmp : -cmp) || a.answer.localeCompare(b.answer);
      });
    const headCell = (key: SortKey, label: string) =>
      h(
        'button.sort',
        { class: key === sortKey ? 'sort active' : 'sort', onclick: () => { if (sortKey === key) sortAsc = !sortAsc; else { sortKey = key; sortAsc = key !== 'added'; } drawTable(); } },
        label,
        key === sortKey ? h('span.sort-arrow', sortAsc ? '↑' : '↓') : null,
      );
    table.append(h('div.bank-row.head', h('span'), ...COLUMNS.map(([k, l]) => headCell(k, l)), h('span')));
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
    const en = h('input.enum', { value: e.enum || String(e.answer.length), class: e.enum ? 'enum' : 'enum derived' }) as HTMLInputElement;
    en.oninput = () => {
      en.value = en.value.replace(/[^0-9,'\-]/g, '');
      const custom = en.value !== '' && en.value !== String(e.answer.length);
      en.classList.toggle('derived', !custom);
      save({ enum: custom ? en.value : '' });
    };
    en.onblur = () => { if (!en.value) { en.value = String(e.answer.length); en.classList.add('derived'); } };
    const tags = h('input', { value: e.tags.join(', '), oninput: () => save({ tags: tags.value.split(',').map((t) => t.trim()).filter(Boolean) }) }) as HTMLInputElement;
    const added = e.created ? new Date(e.created) : null;
    return h(
      'div.bank-row',
      chk,
      h('span.answer', e.answer),
      clue,
      en,
      tags,
      h('span.muted', { title: added ? added.toLocaleString() : '' }, added && !isNaN(+added) ? added.toLocaleDateString() : ''),
      h('span.muted', e.usedIn.length ? String(e.usedIn.length) : ''),
      iconButton('trash', 'Delete', () => { bankStore.delete(e.id); drawTable(); toast(`Deleted ${e.answer}`, () => { bankStore.put(e); drawTable(); }); }, { cls: 'icon-link' }),
    );
  }
}
