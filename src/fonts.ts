import { BUNDLED_FONTS, FontRole, fontDef } from './model/theme';
import { FontSet } from './model/types';
import { Measurer } from './render/ops';
import { roleFont } from './render/svg';

const base = import.meta.env.BASE_URL;

/** Register the bundled fonts with the document. */
export function installFontFaces(): void {
  const css = BUNDLED_FONTS.map(
    (f) =>
      `@font-face{font-family:"${f.family}";font-weight:${f.weight};font-style:${f.style};src:url("${base}${f.file}") format("truetype");font-display:swap;}`,
  ).join('\n');
  const el = document.createElement('style');
  el.id = 'bundled-fonts';
  el.textContent = css;
  document.head.appendChild(el);
}

const dataCache = new Map<string, Promise<Uint8Array>>();

/** Raw bytes of a bundled font (for PDF embedding and SVG data URLs). */
export function fontBytes(id: string): Promise<Uint8Array> {
  const def = fontDef(id);
  if (!def.file) return Promise.reject(new Error(`font ${id} is not bundled`));
  let p = dataCache.get(id);
  if (!p) {
    p = fetch(base + def.file).then(async (r) => new Uint8Array(await r.arrayBuffer()));
    dataCache.set(id, p);
  }
  return p;
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** @font-face CSS with data URLs for every bundled font the font set uses. */
export async function embeddedFontFaces(fonts: FontSet): Promise<string> {
  const ids = new Set<string>();
  for (const role of ['clues', 'answers', 'numbers'] as FontRole[]) {
    for (const bold of [false, true]) {
      const def = roleFont(fonts, role, bold).def;
      if (def.file) ids.add(def.id);
    }
  }
  const rules: string[] = [];
  for (const id of ids) {
    const def = fontDef(id);
    const b64 = toBase64(await fontBytes(id));
    rules.push(
      `@font-face{font-family:"${def.family}";font-weight:${def.weight};font-style:${def.style};src:url(data:font/ttf;base64,${b64}) format("truetype");}`,
    );
  }
  return rules.join('\n');
}

/** Wait until the fonts a set uses are loaded in the document. */
export async function ensureLoaded(fonts: FontSet): Promise<void> {
  const specs: string[] = [];
  for (const role of ['clues', 'answers', 'numbers'] as FontRole[]) {
    for (const bold of [false, true]) {
      const f = roleFont(fonts, role, bold);
      specs.push(`${f.style} ${f.weight} 16px "${f.family}"`);
    }
  }
  await Promise.all(specs.map((s) => document.fonts.load(s).catch(() => undefined)));
}

/** Measure text with a canvas, using the document's loaded fonts. */
export function canvasMeasurer(fonts: FontSet): Measurer {
  const ctx = document.createElement('canvas').getContext('2d')!;
  return {
    width(text, role, size, bold) {
      const f = roleFont(fonts, role, bold);
      ctx.font = `${f.style} ${f.weight} ${size}px "${f.family}"`;
      return ctx.measureText(text).width;
    },
  };
}
