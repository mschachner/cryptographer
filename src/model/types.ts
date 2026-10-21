export type Dir = 'A' | 'D';

export interface Cell {
  r: number;
  c: number;
  l: string; // single uppercase letter or ''
}

export interface Slot {
  r: number; // start row
  c: number; // start col
  dir: Dir;
  len: number;
  number: number;
}

export interface Entry extends Slot {
  answer: string; // letters of the slot, '·' for empty
  clue: string;
  enum: string; // '' means use slot length
}

export interface ClueText {
  clue: string;
  enum: string;
}

export interface OrphanClue extends ClueText {
  answer: string;
  dir: Dir;
}

/** Key for in-memory clue storage: start cell + direction. */
export type ClueKey = `${number},${number},${Dir}`;

export interface ThemeColors {
  page: string;
  surface: string;
  cell: string;
  cellOutline: string;
  ink: string;
  number: string;
  accent: string;
  highlight: string;
  muted: string;
  /** Void squares inside the grid's bounding box; equal to `page` means they are left as page. */
  block: string;
}

export interface Theme {
  id: string;
  name: string;
  colors: ThemeColors;
  cornerRadius: number; // fraction of cell size
  /** Id of a background texture tile laid over the page colour; empty or absent for none. */
  texture?: string;
  /** Use light text and icons on buttons whose colour is dark enough. Absent means on. */
  lightOnDark?: boolean;
  builtin?: boolean;
}

export interface FontSet {
  id: string;
  name: string;
  clues: string; // font id (see fonts.ts)
  answers: string;
  numbers: string;
  builtin?: boolean;
}

/** In-memory puzzle. */
export interface Puzzle {
  schema: 1;
  id: string;
  title: string;
  author: string;
  notes: string;
  created: string;
  modified: string;
  cells: Map<string, Cell>; // key "r,c"
  clues: Map<ClueKey, ClueText>;
  orphans: OrphanClue[];
  theme: string | Theme;
  fonts: string | FontSet;
}

/** Persisted / shared form. */
export interface PuzzleJSON {
  schema: 1;
  id: string;
  title: string;
  author: string;
  notes: string;
  created: string;
  modified: string;
  cells: Cell[];
  clues: Record<string, ClueText>; // keyed "1A", "1D"
  orphans?: OrphanClue[];
  theme: string | Theme;
  fonts: string | FontSet;
}

export interface BankEntry {
  id: string;
  answer: string; // uppercase, no spaces/hyphens
  enum: string;
  clue: string;
  notes: string;
  tags: string[];
  created: string;
  usedIn: string[];
}

export const cellKey = (r: number, c: number) => `${r},${c}`;
export const clueKey = (r: number, c: number, dir: Dir): ClueKey => `${r},${c},${dir}`;
