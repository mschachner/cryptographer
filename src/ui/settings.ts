import { FontSet, Theme, ThemeColors, cellKey } from '../model/types';
import { BUNDLED_FONTS, COLOR_ROLES, COLOR_ROLE_LABELS, FONT_FAMILIES, FONT_ROLES, FONT_ROLE_LABELS, FontRole, HEATHER, TEXTURES, onAccent, textureUrl } from '../model/theme';
import { newId } from '../model/puzzle';
import { fontSetStore, settingsStore, themeStore } from '../store/db';
import { allFontSets, allThemes, applyChrome, currentFonts, currentTheme, mount, nav } from './app';
import { download, h, toast } from './dom';
import { renderGrid } from '../render/grid';
import { opsToSvgInner } from '../render/svg';
import { Cells } from '../model/grid';
import { colorPicker } from './colorPicker';
import { icon } from './icons';

export function settingsScreen(root: HTMLElement) {
  const settings = settingsStore.get();
  let theme: Theme = structuredClone(currentTheme(settings.theme));
  let fonts: FontSet = structuredClone(currentFonts(settings.fonts));
  let themeDirty = false;
  let fontsDirty = false;
  applyChrome(theme, fonts);

  // ---------- preview ----------
  const sample: Cells = new Map();
  ['CRYPTIC', 'L......', 'U......', 'E......', 'S......'].forEach((row, r) => [...row].forEach((ch, c) => { if (ch !== '.') sample.set(cellKey(r, c), { r, c, l: ch }); }));
  const previewGrid = h('div.preview-grid');
  const previewPanel = h('div.preview-panel');
  const fontFamilyOf = (role: FontRole) => BUNDLED_FONTS.find((f) => f.id === fonts[role])?.family ?? fonts[role].replace(/^system:/, '');
  const drawPreview = () => {
    const ops = renderGrid(sample, { cellSize: 34, theme, cursor: { r: 0, c: 1 }, slot: new Set([0, 1, 2, 3, 4, 5, 6].map((c) => cellKey(0, c))) });
    previewGrid.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-5 -5 ${7 * 34 + 10} ${5 * 34 + 10}" width="100%">${opsToSvgInner(ops, fonts)}</svg>`;
    const tex = textureUrl(theme.texture, import.meta.env.BASE_URL);
    previewGrid.style.background = `${tex ? `url("${tex}") ` : ''}${theme.colors.page}`;
    const c = theme.colors;
    const num = `"${fontFamilyOf('numbers')}"`;
    previewPanel.style.background = c.surface;
    previewPanel.replaceChildren(
      h('div.pv-row', h('span.pv-num', { style: { color: c.number, fontFamily: num } }, '1'), h('span', { style: { color: c.ink } }, 'Across clue (5,2)')),
      h('div.pv-row', { style: { background: c.highlight } }, h('span.pv-num', { style: { color: c.number, fontFamily: num } }, '4'), h('span', { style: { color: c.ink } }, 'Current entry')),
      h('div.pv-row', h('span.pv-num', { style: { color: c.number, fontFamily: num } }, '5'), h('span', { style: { color: c.muted } }, 'Secondary text')),
      h('span.pv-btn', { style: { background: c.accent, color: onAccent(theme), borderRadius: `${theme.cornerRadius * 40}px` } }, 'Button'),
    );
  };

  // ---------- theme chooser ----------
  const themeSel = h('select') as HTMLSelectElement;
  const fillThemeSel = () => {
    themeSel.replaceChildren();
    for (const t of allThemes()) themeSel.append(h('option', { value: t.id, selected: t.id === theme.id }, t.name));
  };
  themeSel.onchange = () => {
    settings.theme = themeSel.value;
    settingsStore.put(settings);
    theme = structuredClone(currentTheme(settings.theme));
    themeDirty = false;
    refreshTheme();
  };

  // ---------- color chips and picker ----------
  let selectedRole: keyof ThemeColors = 'accent';
  const chips = h('div.chips');
  const picker = colorPicker(theme.colors[selectedRole], (hex) => setColor(selectedRole, hex));
  const pickerLabel = h('span.picker-label');
  const swatchRow = h('div.swatches');
  const drawChips = () => {
    chips.replaceChildren();
    for (const role of COLOR_ROLES) {
      chips.append(
        h(
          'button',
          { class: role === selectedRole ? 'chip selected' : 'chip', onclick: () => { selectedRole = role; picker.set(theme.colors[role]); drawChips(); } },
          h('span.chip-dot', { style: { background: theme.colors[role] } }),
          h('span.chip-name', COLOR_ROLE_LABELS[role]),
        ),
      );
    }
    pickerLabel.textContent = COLOR_ROLE_LABELS[selectedRole];
  };
  const drawSwatches = () => {
    swatchRow.replaceChildren();
    const seen = new Set<string>();
    for (const t of allThemes())
      for (const c of Object.values(t.colors)) {
        const k = c.toUpperCase();
        if (seen.has(k) || seen.size >= 36) continue;
        seen.add(k);
        swatchRow.append(h('button.swatch', { style: { background: c }, title: c, onclick: () => setColor(selectedRole, c, true) }));
      }
  };
  const setColor = (role: keyof ThemeColors, hex: string, updatePicker = false) => {
    if (!themeDirty) fork();
    theme.colors[role] = hex;
    themeDirty = true;
    if (updatePicker) picker.set(hex);
    const dot = (chips as HTMLElement).querySelectorAll<HTMLElement>('.chip-dot')[COLOR_ROLES.indexOf(role)];
    if (dot) dot.style.background = hex;
    applyChrome(theme, fonts);
    drawPreview();
    saveThemeBtn.disabled = !nameIn.value.trim();
  };

  // ---------- corner radius ----------
  const radius = h('input.slider.plain', { type: 'range', min: 0, max: 0.5, step: 0.01 }) as HTMLInputElement;
  const radiusVal = h('span.val');
  radius.oninput = () => {
    if (!themeDirty) fork();
    theme.cornerRadius = +radius.value;
    themeDirty = true;
    radiusVal.textContent = `${Math.round(theme.cornerRadius * 100)}%`;
    applyChrome(theme, fonts);
    drawPreview();
    saveThemeBtn.disabled = !nameIn.value.trim();
  };

  // ---------- light text on dark colors ----------
  const lightChk = h('input', { type: 'checkbox' }) as HTMLInputElement;
  lightChk.onchange = () => {
    if (!themeDirty) fork();
    theme.lightOnDark = lightChk.checked;
    themeDirty = true;
    applyChrome(theme, fonts);
    drawPreview();
    saveThemeBtn.disabled = !nameIn.value.trim();
  };

  // ---------- texture ----------
  const textures = h('div.textures');
  const drawTextures = () => {
    textures.replaceChildren();
    const tileFor = (id: string, label: string) => {
      const tex = textureUrl(id, import.meta.env.BASE_URL);
      return h(
        'button',
        { class: (theme.texture ?? '') === id ? 'texture-tile selected' : 'texture-tile', title: label, onclick: () => setTexture(id) },
        h('span.texture-swatch', { style: { background: `${tex ? `url("${tex}") ` : ''}${theme.colors.page}` } }),
        h('span.texture-name', label),
      );
    };
    textures.append(tileFor('', 'None'));
    for (const t of TEXTURES) textures.append(tileFor(t.id, t.label));
  };
  const setTexture = (id: string) => {
    if (!themeDirty) fork();
    theme.texture = id;
    themeDirty = true;
    applyChrome(theme, fonts);
    drawTextures();
    drawPreview();
    saveThemeBtn.disabled = !nameIn.value.trim();
  };

  // ---------- name, save, delete ----------
  const nameIn = h('input.name', { placeholder: 'Theme name' }) as HTMLInputElement;
  nameIn.oninput = () => { saveThemeBtn.disabled = !nameIn.value.trim(); };
  const saveThemeBtn = h('button.primary', { disabled: true, onclick: () => saveTheme() }, 'Save theme');
  const deleteBtn = h('button.ghost', { onclick: () => deleteTheme() }, 'Delete');
  const fileBtn = h('button.link', { onclick: () => download(new Blob([JSON.stringify(theme, null, 1)], { type: 'application/json' }), `${theme.name || 'theme'}.json`) }, 'Save to file');

  /** Editing a built-in theme turns it into an unsaved copy. */
  const fork = () => {
    if (!theme.builtin) return;
    theme = { ...structuredClone(theme), id: newId('t'), name: `${theme.name} copy`, builtin: false };
    nameIn.value = theme.name;
    deleteBtn.hidden = true;
  };
  const saveTheme = () => {
    const name = nameIn.value.trim();
    if (!name) return;
    if (theme.builtin) fork();
    theme.name = name;
    themeStore.put(theme);
    settings.theme = theme.id;
    settingsStore.put(settings);
    themeDirty = false;
    fillThemeSel();
    refreshTheme();
    toast(`Saved ${name}`);
  };
  const deleteTheme = () => {
    if (theme.builtin) return;
    const gone = theme;
    themeStore.delete(gone.id);
    settings.theme = HEATHER.id;
    settingsStore.put(settings);
    theme = structuredClone(HEATHER);
    themeDirty = false;
    fillThemeSel();
    refreshTheme();
    toast(`Deleted ${gone.name}`, () => { themeStore.put(gone); settings.theme = gone.id; settingsStore.put(settings); theme = structuredClone(gone); themeDirty = false; fillThemeSel(); refreshTheme(); });
  };
  const refreshTheme = () => {
    applyChrome(theme, fonts);
    radius.value = String(theme.cornerRadius);
    radiusVal.textContent = `${Math.round(theme.cornerRadius * 100)}%`;
    lightChk.checked = theme.lightOnDark !== false;
    nameIn.value = theme.builtin ? '' : theme.name;
    deleteBtn.hidden = !!theme.builtin;
    saveThemeBtn.disabled = !themeDirty || !nameIn.value.trim();
    picker.set(theme.colors[selectedRole]);
    drawChips();
    drawSwatches();
    drawTextures();
    drawPreview();
  };

  // ---------- fonts ----------
  const fontSetSel = h('select') as HTMLSelectElement;
  const fillFontSel = () => {
    fontSetSel.replaceChildren();
    for (const f of allFontSets()) fontSetSel.append(h('option', { value: f.id, selected: f.id === fonts.id }, f.name));
  };
  const fontRows = h('div.font-rows');
  const fontName = h('input.name', { placeholder: 'Font set name' }) as HTMLInputElement;
  const saveFontsBtn = h('button.primary', { disabled: true, onclick: () => saveFonts() }, 'Save font set');
  fontName.oninput = () => { saveFontsBtn.disabled = !fontsDirty || !fontName.value.trim(); };
  const forkFonts = () => {
    if (!fonts.builtin) return;
    fonts = { ...fonts, id: newId('f'), name: `${fonts.name} copy`, builtin: false };
    fontName.value = fonts.name;
  };
  const drawFontRows = () => {
    fontRows.replaceChildren();
    for (const role of FONT_ROLES) {
      const sel = h('select') as HTMLSelectElement;
      for (const fam of FONT_FAMILIES) {
        const g = h('optgroup', { label: fam });
        for (const f of BUNDLED_FONTS.filter((f) => f.family === fam)) g.append(h('option', { value: f.id, selected: fonts[role] === f.id }, f.label));
        sel.append(g);
      }
      const isSys = fonts[role].startsWith('system:');
      sel.append(h('option', { value: '__system', selected: isSys }, 'A font installed on this computer'));
      const sys = h('input', { placeholder: 'Font name', value: isSys ? fonts[role].slice(7) : '', hidden: !isSys }) as HTMLInputElement;
      const change = (v: string) => { if (!fontsDirty) forkFonts(); fonts[role] = v; fontsDirty = true; saveFontsBtn.disabled = !fontName.value.trim(); applyChrome(theme, fonts); drawPreview(); };
      sys.oninput = () => change('system:' + sys.value);
      sel.onchange = () => { if (sel.value === '__system') { sys.hidden = false; change('system:' + sys.value); } else { sys.hidden = true; change(sel.value); } };
      fontRows.append(h('label.font-row', h('span', FONT_ROLE_LABELS[role]), sel, sys));
    }
  };
  fontSetSel.onchange = () => {
    settings.fonts = fontSetSel.value;
    settingsStore.put(settings);
    fonts = structuredClone(currentFonts(settings.fonts));
    fontsDirty = false;
    fontName.value = fonts.builtin ? '' : fonts.name;
    saveFontsBtn.disabled = true;
    applyChrome(theme, fonts);
    drawFontRows();
    drawPreview();
  };
  const saveFonts = () => {
    const name = fontName.value.trim();
    if (!name) return;
    if (fonts.builtin) forkFonts();
    fonts.name = name;
    fontSetStore.put(fonts);
    settings.fonts = fonts.id;
    settingsStore.put(settings);
    fontsDirty = false;
    saveFontsBtn.disabled = true;
    fillFontSel();
    toast(`Saved ${name}`);
  };

  const author = h('input', { value: settings.author, placeholder: 'Name shown on exports', oninput: () => { settings.author = author.value; settingsStore.put(settings); } }) as HTMLInputElement;

  fillThemeSel();
  fillFontSel();
  drawFontRows();
  fontName.value = fonts.builtin ? '' : fonts.name;
  const customizeBtn = h('button.ghost.with-icon', { onclick: () => setEditorOpen(editorGrid.hidden) });
  const setEditorOpen = (open: boolean) => {
    editorGrid.hidden = !open;
    customizeBtn.replaceChildren(icon(open ? 'check' : 'sliders'), h('span', open ? 'Done' : 'Customize'));
    customizeBtn.classList.toggle('on', open);
  };
  const editorGrid = h(
          'div.editor-grid',
          { hidden: true },
          h('div.preview', previewGrid, previewPanel),
          h(
            'div.controls',
            chips,
            h('div.picker-head', pickerLabel),
            picker.el,
            swatchRow,
            h('label.slider-row.radius', h('span', 'Corner radius'), radius, radiusVal),
            h('label.check-row', lightChk, h('span', 'Light text on dark colors')),
            h('div.picker-head', 'Texture'),
            textures,
            h('div.row.tight', nameIn, saveThemeBtn, deleteBtn, fileBtn),
          ),
        );
  setEditorOpen(false);
  mount(
    root,
    nav('settings'),
    h(
      'main.settings',
      h('section.theme-editor', h('div.row.tight', h('h2', 'Theme'), themeSel, customizeBtn), editorGrid),
      h('section', h('div.row.tight', h('h2', 'Fonts'), fontSetSel), fontRows, h('div.row.tight', fontName, saveFontsBtn)),
      h('section', h('h2', 'Author'), h('div.row.tight', author)),
    ),
  );
  refreshTheme();
}
