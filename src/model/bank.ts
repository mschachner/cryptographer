import { BankEntry } from './types';
import { newId } from './puzzle';

export function normalizeAnswer(s: string): string {
  return s.toUpperCase().replace(/[^A-Z]/g, '');
}

/** Does a bank answer fit a slot pattern like "S·A··" ('·' or '?' = unknown)? */
export function fitsPattern(answer: string, pattern: string): boolean {
  if (answer.length !== pattern.length) return false;
  for (let i = 0; i < pattern.length; i++) {
    const p = pattern[i];
    if (p !== '·' && p !== '?' && p !== answer[i]) return false;
  }
  return true;
}

export function makeBankEntry(partial: Partial<BankEntry> & { answer: string }): BankEntry {
  return {
    id: partial.id ?? newId('b'),
    answer: normalizeAnswer(partial.answer),
    enum: partial.enum ?? '',
    clue: partial.clue ?? '',
    notes: partial.notes ?? '',
    tags: partial.tags ?? [],
    created: partial.created ?? new Date().toISOString(),
    usedIn: partial.usedIn ?? [],
  };
}

/** Enumeration implied by a spaced/hyphenated answer, e.g. "ICE-CREAM VAN" → "3-5,3". */
export function enumFromSpelling(s: string): string {
  const words = s.trim().toUpperCase().split(/\s+/).filter(Boolean);
  return words.map((w) => w.split('-').map((p) => p.replace(/[^A-Z]/g, '').length).filter((n) => n > 0).join('-')).join(',');
}
