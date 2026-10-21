import { BUNDLED_FONTS, FontRole, FontDef, fontDef } from '../model/theme';
import { FontSet } from '../model/types';
import { Op } from './ops';

export interface RoleFont {
  family: string;
  weight: number;
  style: 'normal' | 'italic';
  def: FontDef;
}

/** CSS font for a role; `bold` asks for the heavier weight when the family has one. */
export function roleFont(fonts: FontSet, role: FontRole, bold = false): RoleFont {
  let def = fontDef(fonts[role]);
  if (bold && def.weight < 700) {
    // a bundled heavier cut of the same family and style, if there is one
    const heavy = BUNDLED_FONTS.find((b) => b.family === def.family && b.style === def.style && b.weight === 700);
    if (heavy) def = heavy;
    else if (!def.file) return { family: def.family, weight: 700, style: def.style, def };
  }
  return { family: def.family, weight: def.weight, style: def.style, def };
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function opToSvg(op: Op, fonts: FontSet): string {
  if (op.kind === 'path') {
    const a: string[] = [`d="${op.d}"`];
    a.push(`fill="${op.fill ?? 'none'}"`);
    if (op.stroke) a.push(`stroke="${op.stroke}" stroke-width="${op.strokeWidth ?? 1}" stroke-linejoin="round"`);
    if (op.dash) a.push(`stroke-dasharray="${op.dash.join(' ')}"`);
    if (op.cls) a.push(`class="${op.cls}"`);
    if (op.data) for (const [k, v] of Object.entries(op.data)) a.push(`data-${k}="${v}"`);
    return `<path ${a.join(' ')}/>`;
  }
  if (op.kind === 'circle') return `<circle cx="${op.cx}" cy="${op.cy}" r="${op.r}" fill="${op.fill}"/>`;
  const f = roleFont(fonts, op.role, op.bold);
  const a: string[] = [
    `x="${op.x}"`,
    `y="${op.y}"`,
    `font-family="${esc(f.family)}"`,
    `font-weight="${f.weight}"`,
    `font-size="${op.size}"`,
    `fill="${op.fill}"`,
  ];
  if (f.style === 'italic') a.push('font-style="italic"');
  if (op.anchor && op.anchor !== 'start') a.push(`text-anchor="${op.anchor}"`);
  if (op.data) for (const [k, v] of Object.entries(op.data)) a.push(`data-${k}="${v}"`);
  return `<text ${a.join(' ')}>${esc(op.text)}</text>`;
}

export function opsToSvgInner(ops: Op[], fonts: FontSet): string {
  return ops.map((o) => opToSvg(o, fonts)).join('');
}

/**
 * A complete standalone SVG document. `fontFaces` is CSS (@font-face rules with data URLs)
 * so the file renders with the right fonts anywhere.
 */
export function svgDocument(ops: Op[], w: number, h: number, fonts: FontSet, fontFaces = ''): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    (fontFaces ? `<defs><style>${fontFaces}</style></defs>` : '') +
    opsToSvgInner(ops, fonts) +
    `</svg>`
  );
}
