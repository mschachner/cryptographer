import { FontRole } from '../model/theme';

/**
 * Drawing operations. Both the SVG backend (editor, solve view, raster export) and the
 * PDF backend consume the same list, so every output is drawn by the same code.
 */
export type Op =
  | {
      kind: 'path';
      d: string;
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
      dash?: number[];
      data?: Record<string, string | number>;
      cls?: string;
    }
  | {
      kind: 'text';
      x: number;
      y: number; // baseline
      text: string;
      role: FontRole;
      size: number;
      fill: string;
      anchor?: 'start' | 'middle' | 'end';
      bold?: boolean; // request a heavier weight of the role's family when available
      data?: Record<string, string | number>;
    }
  | { kind: 'circle'; cx: number; cy: number; r: number; fill: string };

export interface Measurer {
  /** Advance width of `text` set in `role` at `size`. */
  width(text: string, role: FontRole, size: number, bold?: boolean): number;
}

/** Fallback measurer when fonts are unavailable (tests, pre-load). */
export const approxMeasurer: Measurer = {
  width: (text, _role, size) => text.length * size * 0.56,
};

/** Greedy word wrap. */
export function wrap(text: string, role: FontRole, size: number, maxWidth: number, m: Measurer): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const candidate = line ? line + ' ' + w : w;
    if (m.width(candidate, role, size) <= maxWidth || !line) line = candidate;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}
