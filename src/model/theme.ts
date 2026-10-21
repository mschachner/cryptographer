import { FontSet, Theme, ThemeColors } from './types';

function theme(id: string, name: string, cornerRadius: number, colors: ThemeColors, texture = ''): Theme {
  return { id, name, builtin: true, cornerRadius, colors, texture, lightOnDark: true };
}

export interface TextureDef {
  id: string;
  label: string;
}

/** Background tiles from transparenttextures.com, in public/textures/. */
export const TEXTURES: TextureDef[] = [
  { id: 'white-sand', label: 'White sand' },
  { id: 'paper', label: 'Paper' },
  { id: 'cream-paper', label: 'Cream paper' },
  { id: 'natural-paper', label: 'Natural paper' },
  { id: 'textured-paper', label: 'Textured paper' },
  { id: 'handmade-paper', label: 'Handmade paper' },
  { id: 'rice-paper', label: 'Rice paper' },
  { id: 'light-paper-fibers', label: 'Paper fibers' },
  { id: 'exclusive-paper', label: 'Laid paper' },
  { id: 'groovepaper', label: 'Groove paper' },
  { id: 'cardboard-flat', label: 'Cardboard' },
  { id: 'fabric-of-squares', label: 'Fabric' },
  { id: 'fabric-plaid', label: 'Plaid' },
  { id: 'felt', label: 'Felt' },
  { id: 'diamond-upholstery', label: 'Upholstery' },
  { id: 'subtle-white-feathers', label: 'Feathers' },
  { id: 'notebook-dark', label: 'Notebook' },
  { id: 'stardust', label: 'Stardust' },
  { id: 'dark-matter', label: 'Dark matter' },
];

export function textureUrl(id: string | undefined, base: string): string | null {
  if (!id || !TEXTURES.some((t) => t.id === id)) return null;
  return `${base}textures/${id}.png`;
}

/** The default theme, built from the palette the app was designed around. */
export const HEATHER = theme('heather', 'Heather', 0.22, {
  page: '#EBE5D9',
  surface: '#DED6C6',
  cell: '#FBF8F2',
  cellOutline: '#A2ABA1',
  ink: '#2B332C',
  number: '#758976',
  accent: '#9E83B8',
  highlight: '#CCBBDB',
  muted: '#A2ABA1',
  block: '#EBE5D9',
}, 'white-sand');

export const NEWSPRINT = theme('newsprint', 'Newsprint', 0.1, {
  page: '#F4EFE4',
  surface: '#EAE3D4',
  cell: '#FFFDF8',
  cellOutline: '#1F1C18',
  ink: '#1F1C18',
  number: '#6B5F4E',
  accent: '#C9452B',
  highlight: '#F3D9A4',
  muted: '#9A8F7E',
  block: '#1F1C18',
}, 'natural-paper');

export const MARINE = theme('marine', 'Marine', 0.22, {
  page: '#E7EEF2',
  surface: '#D9E4EA',
  cell: '#FBFDFE',
  cellOutline: '#5B7F94',
  ink: '#16303D',
  number: '#3F6A80',
  accent: '#1E6F8E',
  highlight: '#BFE0EC',
  muted: '#8FA8B5',
  block: '#E7EEF2',
});

export const TERRACOTTA = theme('terracotta', 'Terracotta', 0.3, {
  page: '#F6E7DA',
  surface: '#EEDACB',
  cell: '#FFF8F1',
  cellOutline: '#B8866B',
  ink: '#3C2A22',
  number: '#9A5B3C',
  accent: '#C8643C',
  highlight: '#F3C7A8',
  muted: '#B49A8A',
  block: '#F6E7DA',
});

export const MEADOW = theme('meadow', 'Meadow', 0.22, {
  page: '#EEF2E6',
  surface: '#E1E8D5',
  cell: '#FBFCF7',
  cellOutline: '#8FA37E',
  ink: '#26351F',
  number: '#5E7A4C',
  accent: '#7E9A4F',
  highlight: '#D4E3B5',
  muted: '#A3B294',
  block: '#EEF2E6',
});

export const SLATE = theme('slate', 'Slate (dark)', 0.22, {
  page: '#23272B',
  surface: '#2C3136',
  cell: '#363C43',
  cellOutline: '#7A848D',
  ink: '#F1F3F5',
  number: '#ADB5BD',
  accent: '#E0A458',
  highlight: '#4E5B68',
  muted: '#6C757D',
  block: '#23272B',
}, 'dark-matter');

export const PRINT = theme('print', 'Print (black and white)', 0.22, {
  page: '#FFFFFF',
  surface: '#FFFFFF',
  cell: '#FFFFFF',
  cellOutline: '#000000',
  ink: '#000000',
  number: '#000000',
  accent: '#000000',
  highlight: '#DDDDDD',
  muted: '#888888',
  block: '#000000',
});

export const CLASSIC = theme('classic', 'Classic', 0, {
  page: '#FFFFFF',
  surface: '#F4F4F4',
  cell: '#FFFFFF',
  cellOutline: '#000000',
  ink: '#000000',
  number: '#000000',
  accent: '#F6D55C',
  highlight: '#A7D8F0',
  muted: '#777777',
  block: '#111111',
});

export const BUILTIN_THEMES: Theme[] = [HEATHER, NEWSPRINT, MARINE, TERRACOTTA, MEADOW, SLATE, PRINT, CLASSIC];
export const THEA = HEATHER; // former id of the default theme

export const COLOR_ROLES: Array<keyof ThemeColors> = [
  'page',
  'surface',
  'cell',
  'cellOutline',
  'ink',
  'number',
  'accent',
  'highlight',
  'muted',
  'block',
];

export interface FontDef {
  id: string;
  label: string;
  family: string; // CSS family
  weight: number;
  style: 'normal' | 'italic';
  file?: string; // bundled file under fonts/, relative to app base
}

export const COLOR_ROLE_LABELS: Record<keyof ThemeColors, string> = {
  page: 'Page',
  surface: 'Panels',
  cell: 'Cells',
  cellOutline: 'Cell outlines',
  ink: 'Letters and text',
  number: 'Numbers',
  accent: 'Cursor',
  highlight: 'Current entry',
  muted: 'Secondary',
  block: 'Blocks',
};

type V = [suffix: string, weight: number, style: 'normal' | 'italic', label: string];
const variants = (family: string, file: string, vs: V[]): FontDef[] =>
  vs.map(([suffix, weight, style, label]) => ({
    id: `${file.toLowerCase()}-${suffix.toLowerCase()}`,
    label: `${family} ${label}`,
    family,
    weight,
    style,
    file: `fonts/${file}-${suffix}.ttf`,
  }));

const RBI: V[] = [['Regular', 400, 'normal', 'Regular'], ['Italic', 400, 'italic', 'Italic'], ['Bold', 700, 'normal', 'Bold'], ['BoldItalic', 700, 'italic', 'Bold Italic']];

export const BUNDLED_FONTS: FontDef[] = [
  ...variants('Merriweather', 'Merriweather', [
    ['Regular', 400, 'normal', 'Regular'],
    ['Italic', 400, 'italic', 'Italic'],
    ['Bold', 700, 'normal', 'Bold'],
    ['Black', 900, 'normal', 'Black (UltraBold)'],
    ['BlackItalic', 900, 'italic', 'Black Italic (UltraBold Italic)'],
  ]),
  ...variants('Lora', 'Lora', RBI),
  ...variants('Libre Baskerville', 'LibreBaskerville', RBI),
  ...variants('EB Garamond', 'EBGaramond', RBI),
  ...variants('Playfair Display', 'PlayfairDisplay', [
    ['Regular', 400, 'normal', 'Regular'],
    ['Italic', 400, 'italic', 'Italic'],
    ['Bold', 700, 'normal', 'Bold'],
    ['Black', 900, 'normal', 'Black'],
    ['BlackItalic', 900, 'italic', 'Black Italic'],
  ]),
  ...variants('Bitter', 'Bitter', [
    ['Regular', 400, 'normal', 'Regular'],
    ['Italic', 400, 'italic', 'Italic'],
    ['Bold', 700, 'normal', 'Bold'],
    ['Black', 900, 'normal', 'Black'],
    ['BlackItalic', 900, 'italic', 'Black Italic'],
  ]),
  ...variants('Atkinson Hyperlegible', 'AtkinsonHyperlegible', RBI),
  ...variants('Alfa Slab One', 'AlfaSlabOne', [['Regular', 400, 'normal', 'Regular']]),
];

export const FONT_FAMILIES: string[] = [...new Set(BUNDLED_FONTS.map((f) => f.family))];

export const DEFAULT_FONTS: FontSet = {
  id: 'default',
  name: 'Merriweather',
  builtin: true,
  clues: 'merriweather-regular',
  answers: 'merriweather-blackitalic',
  numbers: 'merriweather-regular',
};

export type FontRole = 'clues' | 'answers' | 'numbers';
export const FONT_ROLES: FontRole[] = ['clues', 'answers', 'numbers'];
export const FONT_ROLE_LABELS: Record<FontRole, string> = { clues: 'Clues and text', answers: 'Answers in the grid', numbers: 'Numbers' };

/** Resolve a font id to a definition. "system:Name" denotes a locally installed family. */
export function fontDef(id: string): FontDef {
  if (id === 'merriweather-black-italic') id = 'merriweather-blackitalic'; // earlier id
  const b = BUNDLED_FONTS.find((f) => f.id === id);
  if (b) return b;
  if (id.startsWith('system:')) {
    const family = id.slice(7);
    return { id, label: family, family, weight: 400, style: 'normal' };
  }
  return BUNDLED_FONTS[0];
}

export function resolveTheme(t: string | Theme, custom: Theme[]): Theme {
  if (t === 'thea') t = 'heather';
  const found = typeof t === 'object' ? t : BUILTIN_THEMES.find((x) => x.id === t) ?? custom.find((x) => x.id === t) ?? HEATHER;
  // fill roles missing from themes saved by older versions
  return { ...found, lightOnDark: found.lightOnDark ?? true, colors: { ...HEATHER.colors, ...found.colors } };
}

export function resolveFonts(f: string | FontSet, custom: FontSet[]): FontSet {
  if (typeof f === 'object') return f;
  return f === 'default' ? DEFAULT_FONTS : custom.find((x) => x.id === f) ?? DEFAULT_FONTS;
}

/** Relative luminance of a hex color, from 0 to 1. */
export function luminance(hex: string): number {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex);
  if (!m) return 0;
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(parseInt(m[1], 16)) + 0.7152 * lin(parseInt(m[2], 16)) + 0.0722 * lin(parseInt(m[3], 16));
}

/**
 * Text color for buttons and tiles filled with the accent. With `lightOnDark` on, a dark
 * enough accent gets the lighter of the theme's page and ink colors; otherwise ink.
 */
export function onAccent(t: Theme): string {
  if (t.lightOnDark === false) return t.colors.ink;
  const { page, ink, accent } = t.colors;
  const light = luminance(page) > luminance(ink) ? page : ink;
  const dark = light === page ? ink : page;
  return luminance(accent) < 0.4 ? light : dark;
}
