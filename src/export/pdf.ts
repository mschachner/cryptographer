import { PDFDocument, PDFFont, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { FontSet } from '../model/types';
import { FontRole } from '../model/theme';
import { Measurer } from '../render/ops';
import { Page } from '../render/page';
import { roleFont } from '../render/svg';
import { fontBytes } from '../fonts';

function hex(c: string) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(c);
  if (!m) return rgb(0, 0, 0);
  return rgb(parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255);
}

export class PdfFonts {
  private cache = new Map<string, PDFFont>();
  constructor(private doc: PDFDocument, private fonts: FontSet) {}

  async load(): Promise<void> {
    for (const role of ['clues', 'answers', 'numbers'] as FontRole[])
      for (const bold of [false, true]) await this.get(role, bold);
  }

  async get(role: FontRole, bold = false): Promise<PDFFont> {
    const f = roleFont(this.fonts, role, bold);
    const key = f.def.file ? `${f.family}|${f.weight}|${f.style}` : `std|${bold}|${f.style}`;
    let font = this.cache.get(key);
    if (font) return font;
    if (f.def.file) {
      // find the bundled file matching family/weight/style (bold may map to another file)
      font = await this.doc.embedFont(await fontBytes(f.def.id), { subset: true });
    } else {
      const std = f.style === 'italic' ? (bold ? StandardFonts.TimesRomanBoldItalic : StandardFonts.TimesRomanItalic) : bold ? StandardFonts.TimesRomanBold : StandardFonts.TimesRoman;
      font = await this.doc.embedFont(std);
    }
    this.cache.set(key, font);
    return font;
  }

  sync(role: FontRole, bold = false): PDFFont {
    const f = roleFont(this.fonts, role, bold);
    const key = f.def.file ? `${f.family}|${f.weight}|${f.style}` : `std|${bold}|${f.style}`;
    const font = this.cache.get(key);
    if (!font) throw new Error('font not loaded: ' + key);
    return font;
  }

  measurer(): Measurer {
    return { width: (text, role, size, bold) => this.sync(role, bold).widthOfTextAtSize(text, size) };
  }
}

export async function newPdf(fonts: FontSet): Promise<{ doc: PDFDocument; pf: PdfFonts }> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setProducer('Cryptographer');
  const pf = new PdfFonts(doc, fonts);
  await pf.load();
  return { doc, pf };
}

export function drawPage(doc: PDFDocument, pf: PdfFonts, page: Page): void {
  const pg = doc.addPage([page.w, page.h]);
  const H = page.h;
  for (const op of page.ops) {
    if (op.kind === 'path') {
      pg.drawSvgPath(op.d, {
        x: 0,
        y: H,
        color: op.fill && op.fill !== 'none' ? hex(op.fill) : undefined,
        borderColor: op.stroke ? hex(op.stroke) : undefined,
        borderWidth: op.stroke ? op.strokeWidth ?? 1 : 0,
        borderDashArray: op.dash,
      });
    } else if (op.kind === 'circle') {
      pg.drawCircle({ x: op.cx, y: H - op.cy, size: op.r, color: hex(op.fill) });
    } else {
      const font = pf.sync(op.role, op.bold);
      let x = op.x;
      if (op.anchor === 'middle') x -= font.widthOfTextAtSize(op.text, op.size) / 2;
      else if (op.anchor === 'end') x -= font.widthOfTextAtSize(op.text, op.size);
      pg.drawText(op.text, { x, y: H - op.y, size: op.size, font, color: hex(op.fill) });
    }
  }
}
