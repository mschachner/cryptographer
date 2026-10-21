type Child = Node | string | number | null | undefined | false | Child[];

/** Tiny element builder: h('button.primary', {onclick}, 'Label'). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function h(spec: string, attrs?: Record<string, unknown> | Child, ...children: Child[]): any {
  const [tag, ...classes] = spec.split('.');
  const el = document.createElement(tag || 'div');
  if (classes.length) el.className = classes.join(' ');
  if (attrs && typeof attrs === 'object' && !(attrs instanceof Node) && !Array.isArray(attrs)) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') (el as any)[k] = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset' && typeof v === 'object') Object.assign(el.dataset, v);
      else if (k in el && k !== 'list' && typeof v !== 'string') (el as any)[k] = v;
      else el.setAttribute(k, String(v));
    }
  } else if (attrs !== undefined) {
    children.unshift(attrs as Child);
  }
  append(el, children);
  return el;
}

export function append(el: Node, children: Child[]) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

export function clear(el: Element) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function svgEl(markup: string): SVGSVGElement {
  const t = document.createElement('template');
  t.innerHTML = markup;
  return t.content.firstElementChild as SVGSVGElement;
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function slug(s: string): string {
  return (s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'puzzle').slice(0, 60);
}

/** Modal dialog shell. Returns the dialog; caller fills `body`. */
export function dialog(title: string, body: HTMLElement, actions: HTMLElement[]): HTMLDialogElement {
  const d = h('dialog.modal') as HTMLDialogElement;
  d.append(
    h('header', h('h2', title), h('button.icon', { onclick: () => d.close(), 'aria-label': 'Close' }, '×')),
    h('div.modal-body', body),
    h('footer', actions),
  );
  d.addEventListener('close', () => d.remove());
  d.addEventListener('click', (e) => {
    if (e.target === d) d.close();
  });
  document.body.appendChild(d);
  d.showModal();
  return d;
}

export function toast(text: string, undo?: () => void) {
  const t = h('div.toast', text);
  if (undo)
    t.append(
      h(
        'button.link',
        {
          onclick: () => {
            undo();
            t.remove();
          },
        },
        'Undo',
      ),
    );
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 6000);
}

/** Small popover menu anchored to an element. Closes on outside click or Escape. */
export function popoverMenu(anchor: HTMLElement, items: Array<{ label: string; onclick: () => void; danger?: boolean }>) {
  document.querySelectorAll('.popover').forEach((p) => p.remove());
  const menu = h('div.popover', ...items.map((it) => h('button', { class: it.danger ? 'danger' : '', onclick: () => { close(); it.onclick(); } }, it.label)));
  document.body.appendChild(menu);
  const r = anchor.getBoundingClientRect();
  menu.style.top = `${r.bottom + 6 + window.scrollY}px`;
  menu.style.left = `${Math.min(r.right - menu.offsetWidth, window.innerWidth - menu.offsetWidth - 8) + window.scrollX}px`;
  const close = () => { menu.remove(); document.removeEventListener('pointerdown', onDoc, true); document.removeEventListener('keydown', onKey); };
  const onDoc = (e: Event) => { if (!menu.contains(e.target as Node) && e.target !== anchor) close(); };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
  setTimeout(() => { document.addEventListener('pointerdown', onDoc, true); document.addEventListener('keydown', onKey); });
  return close;
}
