import { Puzzle } from '../model/types';
import { PRINT } from '../model/theme';
import { PAPER_WHITE, Page, layoutGridOnly, layoutPages, paperSize } from '../render/page';
import { svgDocument } from '../render/svg';
import { pageToRaster, pageToSvg } from '../export/raster';
import { canvasMeasurer, ensureLoaded } from '../fonts';
import { allThemes, currentFonts, currentTheme } from './app';
import { dialog, download, h, slug, svgEl, toast } from './dom';
import { isComplete } from '../model/puzzle';
import { puzzleStore } from '../store/db';

type Orientation = 'portrait' | 'landscape';

export function openExportDialog(p: Puzzle) {
  const fonts = currentFonts();
  const appTheme = currentTheme();

  // ---- options ----
  const format = select([['pdf', 'PDF document'], ['png', 'PNG image'], ['jpeg', 'JPEG image'], ['svg', 'Vector drawing of the grid']], 'pdf');
  const content = select([['clues', 'Grid and clues'], ['grid', 'Grid only']], 'clues');
  const letters = select([['blank', 'Blank, for solving'], ['filled', 'Filled in, as an answer key']], 'blank');
  const themeSel = select([['__app', `${appTheme.name} (current)`], ...allThemes().filter((t) => t.id !== appTheme.id).map((t) => [t.id, t.name] as [string, string])], '__app');
  const orientation = select([['portrait', 'Portrait'], ['landscape', 'Landscape']], 'portrait');
  const width = h('input', { type: 'number', value: 1600, min: 400, max: 6000, step: 100 }) as HTMLInputElement;

  // ---- metadata (written back to the puzzle) ----
  const titleIn = h('input', { value: p.title, placeholder: 'Title' }) as HTMLInputElement;
  const authorIn = h('input', { value: p.author, placeholder: 'Author' }) as HTMLInputElement;
  const dateChk = h('input', { type: 'checkbox', checked: true }) as HTMLInputElement;
  const saveMeta = () => {
    const changed = p.title !== titleIn.value || p.author !== authorIn.value;
    p.title = titleIn.value;
    p.author = authorIn.value;
    if (changed) {
      p.modified = new Date().toISOString();
      puzzleStore.put(p);
      document.querySelectorAll('.crumb, input.title').forEach((el) => {
        if (el instanceof HTMLInputElement) el.value = p.title;
        else el.textContent = p.title || 'Untitled';
      });
    }
  };

  const c = isComplete(p);
  const warn = h('div.warn', { hidden: !(c.empty || c.clued < c.entries) }, [c.empty ? `${c.empty} empty cells` : '', c.clued < c.entries ? `${c.entries - c.clued} entries without clues` : ''].filter(Boolean).join(' · '));

  const options = h(
    'div.form',
    h('h4', 'Document'),
    field('Format', format),
    field('Content', content),
    field('Letters', letters),
    field('Theme', themeSel),
    field('Orientation', orientation),
    field('Image width', h('span.with-unit', width, h('span.muted', 'px'))),
    h('h4', 'Details'),
    field('Title', titleIn),
    field('Author', authorIn),
    field('Show date', dateChk),
    warn,
  );
  const preview = h('div.export-preview');
  const previewNote = h('div.preview-note.muted');
  const body = h('div.export-body', options, h('div.export-right', preview, previewNote));

  const refreshVisibility = () => {
    const f = format.value;
    const gridOnly = f === 'svg' || content.value === 'grid';
    row(orientation).hidden = f === 'svg' || gridOnly;
    row(width).hidden = !(f === 'png' || f === 'jpeg');
    row(content).hidden = f === 'svg';
  };

  // ---- preview ----
  let previewTimer: number | undefined;
  const schedulePreview = () => {
    clearTimeout(previewTimer);
    previewTimer = window.setTimeout(drawPreview, 120);
  };
  const theme = () => (themeSel.value === '__app' ? appTheme : allThemes().find((t) => t.id === themeSel.value) ?? PRINT);
  const gridOnly = () => format.value === 'svg' || content.value === 'grid';
  const dateLine = () => (dateChk.checked ? new Date(p.modified).toLocaleDateString() : undefined);
  const buildPages = (): Page[] => {
    if (gridOnly()) return [layoutGridOnly(p, theme(), letters.value === 'filled', 40)];
    const size = paperSize(orientation.value as Orientation);
    return layoutPages(p, { theme: theme(), pageW: size.w, pageH: size.h, withClues: true, showLetters: letters.value === 'filled', measurer: canvasMeasurer(fonts), dateLine: dateLine() });
  };
  async function drawPreview() {
    await ensureLoaded(fonts);
    saveMeta();
    const pages = buildPages();
    const first = pages[0];
    const svg = svgEl(svgDocument(first.ops, first.w, first.h, fonts));
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.classList.add(gridOnly() ? 'grid-only' : 'page');
    svg.style.aspectRatio = `${first.w} / ${first.h}`;
    preview.replaceChildren(svg);
    previewNote.textContent = pages.length > 1 ? `Page 1 of ${pages.length}` : '';
  }

  for (const el of [format, content, letters, themeSel, orientation]) el.onchange = () => { refreshVisibility(); schedulePreview(); };
  for (const el of [titleIn, authorIn]) el.oninput = schedulePreview;
  dateChk.onchange = schedulePreview;
  refreshVisibility();

  const go = h('button.primary', { onclick: async () => { go.disabled = true; try { await run(); d.close(); } catch (e) { console.error(e); toast('The export did not work: ' + (e instanceof Error ? e.message : String(e))); go.disabled = false; } } }, 'Export');
  const d = dialog('Export', body, [go]);
  d.classList.add('export');
  drawPreview();

  async function run() {
    await ensureLoaded(fonts);
    saveMeta();
    const showLetters = letters.value === 'filled';
    const name = slug(p.title) + (showLetters ? '-solution' : '');
    const f = format.value;
    const th = theme();
    if (gridOnly()) {
      const page = layoutGridOnly(p, th, showLetters, 40);
      if (f === 'svg') return download(new Blob([await pageToSvg(page, fonts)], { type: 'image/svg+xml' }), `${name}.svg`);
      if (f === 'png' || f === 'jpeg') return download(await pageToRaster(page, fonts, f === 'png' ? 'image/png' : 'image/jpeg', +width.value, PAPER_WHITE), `${name}.${f}`);
    }
    const size = paperSize(orientation.value as Orientation);
    if (f === 'pdf') {
      const { newPdf, drawPage } = await import('../export/pdf');
      const { doc, pf } = await newPdf(fonts);
      const pages = layoutPages(p, { theme: th, pageW: size.w, pageH: size.h, withClues: true, showLetters, measurer: pf.measurer(), dateLine: dateLine() });
      for (const pg of pages) drawPage(doc, pf, pg);
      doc.setTitle(p.title || 'Crossword');
      if (p.author) doc.setAuthor(p.author);
      const bytes = await doc.save();
      return download(new Blob([bytes as BlobPart], { type: 'application/pdf' }), `${name}.pdf`);
    }
    const pages = buildPages();
    const blob = await pageToRaster(pages[0], fonts, f === 'png' ? 'image/png' : 'image/jpeg', +width.value, PAPER_WHITE);
    download(blob, `${name}.${f}`);
    if (pages.length > 1) toast(`Only the first page is in the image; export a PDF for all ${pages.length} pages`);
  }
}

function select(opts: [string, string][], value: string): HTMLSelectElement {
  const s = h('select') as HTMLSelectElement;
  for (const [v, l] of opts) s.append(h('option', { value: v, selected: v === value }, l));
  return s;
}

export function field(label: string, control: HTMLElement): HTMLElement {
  return h('label.field', h('span', label), control);
}

function row(control: HTMLElement): HTMLElement {
  return control.closest('.field') as HTMLElement;
}
