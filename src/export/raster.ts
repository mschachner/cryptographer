import { FontSet } from '../model/types';
import { Page } from '../render/page';
import { svgDocument } from '../render/svg';
import { embeddedFontFaces } from '../fonts';

/** Standalone SVG text with fonts embedded. */
export async function pageToSvg(page: Page, fonts: FontSet): Promise<string> {
  const faces = await embeddedFontFaces(fonts);
  return svgDocument(page.ops, page.w, page.h, fonts, faces);
}

/** Rasterize a page at `pixelWidth` to PNG or JPEG. */
export async function pageToRaster(page: Page, fonts: FontSet, type: 'image/png' | 'image/jpeg', pixelWidth: number, background: string): Promise<Blob> {
  const svg = await pageToSvg(page, fonts);
  const scale = pixelWidth / page.w;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(page.w * scale);
  canvas.height = Math.round(page.h * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('SVG rasterization failed'));
      img.src = url;
    });
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  } finally {
    URL.revokeObjectURL(url);
  }
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), type, 0.92));
}
