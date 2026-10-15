import * as pdfjs from './vendor/pdfjs/pdf.mjs';
import { binaryData } from './vendor/pdfjs/binary-data.mjs';
import { createLocalOcr } from './local-ocr.mjs';
import { detect, LIMITS } from './privacy-detect.mjs';
pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.mjs', import.meta.url).href;
class LocalData {
  async fetch({ kind, filename }) {
    const entry = ['cMapUrl', 'standardFontDataUrl'].includes(kind) && binaryData[kind];
    if (!entry || !Object.hasOwn(entry, filename)) throw new Error('LOCAL_RESOURCE');
    return Uint8Array.from(atob(entry[filename]), c => c.charCodeAt(0));
  }
}
function inspectSegments(segments, terms, width, height) {
  if (segments.length > 100000) throw new Error('TEXT_LIMIT');
  let text = '';
  for (const segment of segments) { segment.start = text.length; text += segment.text; segment.end = text.length; text += '\n'; }
  const hits = detect(text, terms), masks = [];
  let first = 0;
  for (const hit of hits) {
    while (first < segments.length && segments[first].end <= hit.start) first++;
    for (let index = first; index < segments.length && segments[index].start < hit.end; index++) {
    const segment = segments[index];
    if (segment.start < hit.end && segment.end > hit.start) {
      const b = segment.box;
      // Whole text run/line plus padding, avoiding character-width approximations.
      masks.push({ x: Math.max(0, b.x - 5) / width, y: Math.max(0, b.y - 5) / height,
        w: (Math.min(width, b.x + b.w + 5) - Math.max(0, b.x - 5)) / width,
        h: (Math.min(height, b.y + b.h + 5) - Math.max(0, b.y - 5)) / height, type: hit.type });
      if (masks.length > LIMITS.hits) throw new Error('HIT_LIMIT');
    }
    }
  }
  return { masks, hits, length: text.length };
}
export function createPrivacyPdf() {
  let task, renderTask, ocr, canceled = false;
  const check = () => { if (canceled) throw new Error('CANCELED'); };
  const cancel = () => { canceled = true; renderTask?.cancel(); ocr?.terminate(); void task?.destroy().catch(() => {}); };
  return { cancel, async read(buffer, terms, progress) {
    let protectedFile = false;
    const pages = []; let size = 0, textSize = 0, hitCount = 0;
    try {
      if (new TextDecoder().decode(buffer.slice(0, 1024)).indexOf('%PDF-') < 0) throw new Error('FORMAT');
      task = pdfjs.getDocument({ data: new Uint8Array(buffer), verbosity: 0, isEvalSupported: false,
        enableXfa: false, disableFontFace: true, useSystemFonts: false, useWorkerFetch: false,
        BinaryDataFactory: LocalData, useWasm: false, isImageDecoderSupported: false,
        stopAtErrors: true, cMapPacked: true, disableAutoFetch: true, maxImageSize: 16000000 });
      task.onPassword = () => { protectedFile = true; void task.destroy(); };
      const doc = await task.promise; check();
      if (doc.numPages > LIMITS.pages) throw new Error('PAGE_LIMIT');
      ocr = createLocalOcr(); await ocr.ready; check();
      for (let n = 1; n <= doc.numPages; n++) {
        progress(`${n} / ${doc.numPages}쪽 · 화면과 OCR을 함께 검사합니다`);
        const page = await doc.getPage(n); check();
        const base = page.getViewport({ scale: 1 });
        if (![base.width, base.height].every(v => Number.isFinite(v) && v > 0 && v <= 14400)) throw new Error('PAGE_LIMIT');
        const scale = Math.min(2.3, 2500 / Math.max(base.width, base.height), Math.sqrt(5000000 / (base.width * base.height)));
        const viewport = page.getViewport({ scale }), canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        try {
          renderTask = page.render({ canvasContext: canvas.getContext('2d', { alpha: false }), viewport, background: '#fff' });
          await renderTask.promise; renderTask = null; check();
          const content = await page.getTextContent(); check();
          const segments = content.items.filter(item => item.str).map(item => {
            const m = pdfjs.Util.transform(viewport.transform, item.transform);
            const h = Math.max(Math.hypot(m[2], m[3]), item.height * scale, 1), w = Math.max(item.width * scale, h);
            const angle = Math.atan2(m[1], m[0]), ux = Math.cos(angle), uy = Math.sin(angle);
            const points = [[0, -h * 1.35], [w, -h * 1.35], [0, h * 0.4], [w, h * 0.4]].map(([x, y]) => [m[4] + x * ux - y * uy, m[5] + x * uy + y * ux]);
            const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
            return { text: item.str, box: { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) } };
          });
          const digital = inspectSegments(segments, terms, canvas.width, canvas.height);
          const { data } = await ocr.recognize(canvas, true); check();
          const lines = (data.blocks || []).flatMap(block => (block.paragraphs || []).flatMap(p => p.lines || []));
          const optical = inspectSegments(lines.map(line => ({ text: line.text || '', box: { x: line.bbox.x0, y: line.bbox.y0, w: line.bbox.x1 - line.bbox.x0, h: line.bbox.y1 - line.bbox.y0 } })), terms, canvas.width, canvas.height);
          // If OCR supplied text but no usable boxes, detections cover the full page.
          if (!lines.length && detect(data.text || '', terms).length) optical.masks.push({ x: 0, y: 0, w: 1, h: 1, type: 'OCR 위치 미확인 · 전체 가림' });
          textSize += digital.length + optical.length + (data.text || '').length;
          if (textSize > LIMITS.text) throw new Error('TEXT_LIMIT');
          const masks = [...digital.masks, ...optical.masks].filter(b => b.w > 0 && b.h > 0);
          if ((hitCount += masks.length) > LIMITS.hits) throw new Error('HIT_LIMIT');
          const image = await new Promise(resolve => canvas.toBlob(resolve, 'image/png')); check();
          if (!image || (size += image.size) > 100 * 1024 * 1024) throw new Error('OUTPUT_LIMIT');
          pages.push({ image, width: canvas.width, height: canvas.height, pdfWidth: base.width, pdfHeight: base.height,
            masks, manual: [], number: n, noText: !segments.length && !String(data.text || '').trim() });
        } finally { canvas.width = 0; canvas.height = 0; page.cleanup(); }
      }
      check(); return pages;
    } catch (error) {
      pages.length = 0;
      const known = ['CANCELED', 'FORMAT', 'PAGE_LIMIT', 'TEXT_LIMIT', 'HIT_LIMIT', 'OUTPUT_LIMIT', 'OCR_UNAVAILABLE'];
      throw new Error(protectedFile ? 'PASSWORD' : canceled ? 'CANCELED' : known.includes(error.message) ? error.message : 'PDF_FAILED');
    } finally { ocr?.terminate(); await task?.destroy().catch(() => {}); }
  } };
}
export async function paintPage(page, showOriginal = false) {
  const canvas = document.createElement('canvas'); canvas.width = page.width; canvas.height = page.height;
  const context = canvas.getContext('2d', { alpha: false });
  const bitmap = await createImageBitmap(page.image);
  try { context.drawImage(bitmap, 0, 0); } finally { bitmap.close(); }
  if (!showOriginal) {
    context.fillStyle = '#000';
    for (const mask of [...page.masks, ...page.manual]) context.fillRect(Math.floor(mask.x * page.width), Math.floor(mask.y * page.height), Math.ceil(mask.w * page.width) + 1, Math.ceil(mask.h * page.height) + 1);
  }
  return canvas;
}
