import { deflateSync, inflateSync, strToU8, strFromU8 } from 'fflate';
import { PuzzleJSON } from './types';

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64url(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Compact wire form: drop empty fields; cells as [r,c,letter] triples. */
function compact(j: PuzzleJSON): unknown {
  const o: Record<string, unknown> = { v: 1, id: j.id };
  if (j.title) o.t = j.title;
  if (j.author) o.a = j.author;
  if (j.notes) o.n = j.notes;
  o.c = j.cells.map((c) => [c.r, c.c, c.l || '']);
  const cl: Record<string, [string, string]> = {};
  for (const [k, v] of Object.entries(j.clues)) cl[k] = [v.clue, v.enum];
  o.q = cl;
  if (typeof j.theme === 'object' || j.theme !== 'heather') o.th = j.theme;
  if (typeof j.fonts === 'object' || j.fonts !== 'default') o.f = j.fonts;
  return o;
}

function expand(o: any): PuzzleJSON {
  const now = new Date().toISOString();
  const clues: PuzzleJSON['clues'] = {};
  for (const [k, v] of Object.entries(o.q ?? {}) as [string, [string, string]][]) clues[k] = { clue: v[0], enum: v[1] };
  return {
    schema: 1,
    id: o.id,
    title: o.t ?? '',
    author: o.a ?? '',
    notes: o.n ?? '',
    created: now,
    modified: now,
    cells: (o.c as [number, number, string][]).map(([r, c, l]) => ({ r, c, l })),
    clues,
    theme: o.th ?? 'heather',
    fonts: o.f ?? 'default',
  };
}

export function encodePuzzle(j: PuzzleJSON): string {
  const bytes = deflateSync(strToU8(JSON.stringify(compact(j))), { level: 9 });
  return b64url(bytes);
}

export function decodePuzzle(s: string): PuzzleJSON {
  const json = strFromU8(inflateSync(unb64url(s)));
  return expand(JSON.parse(json));
}

/** Short stable hash of a share payload, used to key solver progress. */
export function hashString(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
