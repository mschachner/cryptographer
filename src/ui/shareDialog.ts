import QRCode from 'qrcode';
import { Puzzle } from '../model/types';
import { toJSON, withoutAnswers } from '../model/puzzle';
import { encodePuzzle } from '../model/codec';
import { dialog, h, toast } from './dom';
import { field } from './exportDialog';
import { iconButton } from './icons';

export function shareUrl(p: Puzzle, includeAnswers: boolean): string {
  const j = includeAnswers ? toJSON(p) : withoutAnswers(toJSON(p));
  const base = location.href.split('#')[0];
  return `${base}#p=${encodePuzzle(j)}`;
}

export function openShareDialog(p: Puzzle) {
  const answers = h('input', { type: 'checkbox', checked: true }) as HTMLInputElement;
  const link = h('input.link-field', { readonly: true }) as HTMLInputElement;
  const qr = h('img.qr', { alt: '' }) as HTMLImageElement;
  const size = h('span.muted');
  const update = async () => {
    const url = shareUrl(p, answers.checked);
    link.value = url;
    size.textContent = `${(url.length / 1024).toFixed(1)} KB`;
    try {
      qr.src = await QRCode.toDataURL(url, { margin: 1, width: 220, errorCorrectionLevel: 'L' });
      qr.hidden = false;
    } catch {
      qr.hidden = true;
    }
  };
  answers.onchange = update;
  const body = h('div.form', field('Include answers', answers), h('div.linkrow', link, size), qr);
  const copy = iconButton('copy', 'Copy link', async () => { await navigator.clipboard.writeText(link.value); toast('Link copied'); }, { text: true, cls: 'primary' });
  const open = iconButton('eye', 'Open', () => window.open(link.value, '_blank'), { text: true });
  dialog('Share', body, [open, copy]);
  update();
}
