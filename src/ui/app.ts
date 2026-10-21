import { FontSet, Theme } from '../model/types';
import { BUILTIN_THEMES, DEFAULT_FONTS, onAccent, resolveFonts, resolveTheme, textureUrl } from '../model/theme';
import { fontSetStore, settingsStore, themeStore } from '../store/db';
import { roleFont } from '../render/svg';
import { h, clear, dialog } from './dom';
import { helpContent } from './help';
import { icon } from './icons';

export interface Route {
  name: 'home' | 'library' | 'edit' | 'bank' | 'settings' | 'solve' | 'preview';
  id?: string;
  payload?: string;
}

export function parseRoute(hash: string): Route {
  const s = hash.replace(/^#/, '');
  if (s.startsWith('p=')) return { name: 'solve', payload: s.slice(2) };
  const parts = s.replace(/^\//, '').split('/');
  switch (parts[0]) {
    case 'library':
      return { name: 'library' };
    case 'edit':
      return { name: 'edit', id: parts[1] };
    case 'bank':
      return { name: 'bank' };
    case 'settings':
      return { name: 'settings' };
    case 'preview':
      return { name: 'preview', id: parts[1] };
    default:
      return { name: 'home' };
  }
}

export function go(hash: string) {
  location.hash = hash;
}

/** Apply a theme and font set to the app chrome through CSS variables. */
export function applyChrome(theme: Theme, fonts: FontSet) {
  const r = document.documentElement.style;
  for (const [k, v] of Object.entries(theme.colors)) r.setProperty(`--c-${k}`, v);
  r.setProperty('--radius', `${theme.cornerRadius * 40}px`);
  r.setProperty('--c-onAccent', onAccent(theme));
  const tex = textureUrl(theme.texture, import.meta.env.BASE_URL);
  r.setProperty('--texture', tex ? `url("${tex}")` : 'none');
  const ui = roleFont(fonts, 'clues');
  const num = roleFont(fonts, 'numbers');
  const ans = roleFont(fonts, 'answers');
  r.setProperty('--font-ui', `"${ui.family}", Georgia, serif`);
  r.setProperty('--font-ui-weight', String(ui.weight));
  r.setProperty('--font-ui-style', ui.style);
  r.setProperty('--font-num', `"${num.family}", Georgia, serif`);
  r.setProperty('--font-num-weight', String(num.weight));
  r.setProperty('--font-ans', `"${ans.family}", Georgia, serif`);
  r.setProperty('--font-ans-weight', String(ans.weight));
  r.setProperty('--font-ans-style', ans.style);
}

export function currentTheme(id?: string | Theme): Theme {
  return resolveTheme(id ?? settingsStore.get().theme, themeStore.list());
}
export function currentFonts(id?: string | FontSet): FontSet {
  return resolveFonts(id ?? settingsStore.get().fonts, fontSetStore.list());
}

export function allThemes(): Theme[] {
  return [...BUILTIN_THEMES, ...themeStore.list()];
}
export function allFontSets(): FontSet[] {
  return [DEFAULT_FONTS, ...fontSetStore.list()];
}

export function nav(active: Route['name'], middle?: HTMLElement): HTMLElement {
  const link = (name: string, to: string, key: Route['name']) =>
    h('a', { href: to, class: active === key ? 'active' : '' }, name);
  return h(
    'nav.top',
    h('div.nav-left', h('a.brand', { href: '#/' }, 'Cryptographer'), link('Library', '#/library', 'library'), link('Bank', '#/bank', 'bank'), link('Settings', '#/settings', 'settings')),
    h('div.nav-mid', middle ?? null),
    h('div.nav-right', h('a.with-icon', { href: '#help', onclick: (e: Event) => { e.preventDefault(); openHelp(); } }, icon('help', 16), h('span', 'Help'))),
  );
}

export function openHelp() {
  const d = dialog('How to use Cryptographer', helpContent(currentTheme(), currentFonts()), []);
  d.classList.add('wide');
}

export function mount(root: HTMLElement, ...children: HTMLElement[]) {
  clear(root);
  root.append(...children);
}
