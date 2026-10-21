import { BankEntry, FontSet, Puzzle, PuzzleJSON, Theme } from '../model/types';
import { fromJSON, toJSON } from '../model/puzzle';

/**
 * Local persistence behind small interfaces. The prototype uses localStorage;
 * swapping in IndexedDB or a sync layer means replacing this file only.
 */

function read<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch (e) {
    console.error('storage write failed', e);
  }
}

const K = {
  puzzles: 'cryptographer.puzzles',
  bank: 'cryptographer.bank',
  themes: 'cryptographer.themes',
  fontsets: 'cryptographer.fontsets',
  settings: 'cryptographer.settings',
  progress: 'cryptographer.progress',
};

export interface Settings {
  theme: string;
  fonts: string;
  author: string;
  /** Show answers in library and home thumbnails. */
  showAnswers?: boolean;
}

export const puzzleStore = {
  list(): PuzzleJSON[] {
    return read<PuzzleJSON[]>(K.puzzles, []).sort((a, b) => (a.modified < b.modified ? 1 : -1));
  },
  get(id: string): Puzzle | undefined {
    const j = read<PuzzleJSON[]>(K.puzzles, []).find((p) => p.id === id);
    return j ? fromJSON(j) : undefined;
  },
  put(p: Puzzle) {
    const all = read<PuzzleJSON[]>(K.puzzles, []);
    const j = toJSON(p);
    const i = all.findIndex((x) => x.id === p.id);
    if (i >= 0) all[i] = j;
    else all.push(j);
    write(K.puzzles, all);
  },
  putJSON(j: PuzzleJSON) {
    const all = read<PuzzleJSON[]>(K.puzzles, []);
    const i = all.findIndex((x) => x.id === j.id);
    if (i >= 0) all[i] = j;
    else all.push(j);
    write(K.puzzles, all);
  },
  delete(id: string) {
    write(
      K.puzzles,
      read<PuzzleJSON[]>(K.puzzles, []).filter((p) => p.id !== id),
    );
  },
};

export const bankStore = {
  list(): BankEntry[] {
    return read<BankEntry[]>(K.bank, []);
  },
  put(e: BankEntry) {
    const all = read<BankEntry[]>(K.bank, []);
    const i = all.findIndex((x) => x.id === e.id);
    if (i >= 0) all[i] = e;
    else all.push(e);
    write(K.bank, all);
  },
  putAll(es: BankEntry[]) {
    write(K.bank, es);
  },
  delete(id: string) {
    write(K.bank, read<BankEntry[]>(K.bank, []).filter((e) => e.id !== id));
  },
  byAnswer(answer: string): BankEntry | undefined {
    return read<BankEntry[]>(K.bank, []).find((e) => e.answer === answer);
  },
};

export const themeStore = {
  list(): Theme[] {
    return read<Theme[]>(K.themes, []);
  },
  put(t: Theme) {
    const all = read<Theme[]>(K.themes, []);
    const i = all.findIndex((x) => x.id === t.id);
    if (i >= 0) all[i] = t;
    else all.push(t);
    write(K.themes, all);
  },
  delete(id: string) {
    write(K.themes, read<Theme[]>(K.themes, []).filter((t) => t.id !== id));
  },
};

export const fontSetStore = {
  list(): FontSet[] {
    return read<FontSet[]>(K.fontsets, []);
  },
  put(f: FontSet) {
    const all = read<FontSet[]>(K.fontsets, []);
    const i = all.findIndex((x) => x.id === f.id);
    if (i >= 0) all[i] = f;
    else all.push(f);
    write(K.fontsets, all);
  },
  delete(id: string) {
    write(K.fontsets, read<FontSet[]>(K.fontsets, []).filter((t) => t.id !== id));
  },
};

export const settingsStore = {
  get(): Settings {
    return { theme: 'heather', fonts: 'default', author: '', ...read<Partial<Settings>>(K.settings, {}) };
  },
  put(s: Settings) {
    write(K.settings, s);
  },
};

export const progressStore = {
  get(hash: string): Record<string, string> {
    return read<Record<string, Record<string, string>>>(K.progress, {})[hash] ?? {};
  },
  put(hash: string, fill: Record<string, string>) {
    const all = read<Record<string, Record<string, string>>>(K.progress, {});
    all[hash] = fill;
    write(K.progress, all);
  },
};

export function exportAll(): string {
  return JSON.stringify(
    {
      cryptographer: 1,
      puzzles: read(K.puzzles, []),
      bank: read(K.bank, []),
      themes: read(K.themes, []),
      fontsets: read(K.fontsets, []),
    },
    null,
    1,
  );
}

export function importAll(text: string): { puzzles: number; bank: number } {
  const o = JSON.parse(text);
  let puzzles = 0, bank = 0;
  if (Array.isArray(o.puzzles)) for (const p of o.puzzles) (puzzleStore.putJSON(p), puzzles++);
  if (Array.isArray(o.bank)) for (const e of o.bank) (bankStore.put(e), bank++);
  if (Array.isArray(o.themes)) for (const t of o.themes) themeStore.put(t);
  if (Array.isArray(o.fontsets)) for (const f of o.fontsets) fontSetStore.put(f);
  // a bare puzzle JSON
  if (o.schema === 1 && Array.isArray(o.cells)) (puzzleStore.putJSON(o), puzzles++);
  return { puzzles, bank };
}
