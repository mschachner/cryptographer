import { h } from './dom';

export function hexToHsl(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex);
  if (!m) return [0, 0, 0];
  const r = parseInt(m[1], 16) / 255, g = parseInt(m[2], 16) / 255, b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let hh = 0;
  if (max === r) hh = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) hh = (b - r) / d + 2;
  else hh = (r - g) / d + 4;
  return [hh * 60, s * 100, l * 100];
}

export function hslToHex(hue: number, sat: number, light: number): string {
  const s = sat / 100, l = light / 100;
  const k = (n: number) => (n + hue / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`.toUpperCase();
}

/**
 * Inline color picker: hue, saturation and lightness sliders with gradient tracks,
 * a hex field, and optional swatches to pick from.
 */
export function colorPicker(initial: string, onChange: (hex: string) => void, swatches: string[] = []): { el: HTMLElement; set(hex: string): void } {
  let [hue, sat, light] = hexToHsl(initial);
  const slider = (min: number, max: number, step: number) => h('input.slider', { type: 'range', min, max, step }) as HTMLInputElement;
  const hueIn = slider(0, 360, 1), satIn = slider(0, 100, 1), lightIn = slider(0, 100, 1);
  const hexIn = h('input.hex', { maxlength: 7, spellcheck: false }) as HTMLInputElement;
  const swatchRow = h('div.swatches');

  const paint = () => {
    hueIn.value = String(Math.round(hue));
    satIn.value = String(Math.round(sat));
    lightIn.value = String(Math.round(light));
    hueIn.style.background = `linear-gradient(to right, ${[0, 60, 120, 180, 240, 300, 360].map((x) => hslToHex(x, Math.max(sat, 40), 50)).join(',')})`;
    satIn.style.background = `linear-gradient(to right, ${hslToHex(hue, 0, light)}, ${hslToHex(hue, 100, light)})`;
    lightIn.style.background = `linear-gradient(to right, #000, ${hslToHex(hue, sat, 50)}, #fff)`;
    const hex = hslToHex(hue, sat, light);
    if (document.activeElement !== hexIn) hexIn.value = hex;
    for (const s of [hueIn, satIn, lightIn]) s.style.setProperty('--thumb', hex);
  };
  const emit = () => {
    paint();
    onChange(hslToHex(hue, sat, light));
  };
  hueIn.oninput = () => { hue = +hueIn.value; emit(); };
  satIn.oninput = () => { sat = +satIn.value; emit(); };
  lightIn.oninput = () => { light = +lightIn.value; emit(); };
  hexIn.oninput = () => {
    const v = hexIn.value.trim();
    if (/^#?[0-9a-f]{6}$/i.test(v)) {
      [hue, sat, light] = hexToHsl(v.startsWith('#') ? v : '#' + v);
      emit();
    }
  };
  hexIn.onblur = () => paint();

  for (const c of swatches) swatchRow.append(h('button.swatch', { style: { background: c }, title: c, onclick: () => { [hue, sat, light] = hexToHsl(c); emit(); } }));

  const rowOf = (label: string, input: HTMLElement) => h('label.slider-row', h('span', label), input);
  const el = h('div.color-picker', rowOf('Hue', hueIn), rowOf('Saturation', satIn), rowOf('Lightness', lightIn), h('div.picker-foot', hexIn, swatchRow));
  paint();
  return {
    el,
    set(hex: string) {
      [hue, sat, light] = hexToHsl(hex);
      paint();
    },
  };
}
