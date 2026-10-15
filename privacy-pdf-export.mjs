const encode = value => new TextEncoder().encode(value);
// New image-only PDF. Nothing from the original PDF object graph is copied.
export async function imageOnlyPdf(pages, paint) {
  const chunks = [encode('%PDF-1.4\n% image-only redacted output\n')], offsets = [0];
  let length = chunks[0].length;
  const append = bytes => { chunks.push(bytes); length += bytes.length; };
  const object = (id, body) => { offsets[id] = length; append(encode(`${id} 0 obj\n${body}\nendobj\n`)); };
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] >>`);
  for (const [i, page] of pages.entries()) {
    const canvas = await paint(page), width = canvas.width, height = canvas.height;
    let blob;
    try { blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.96)); }
    finally { canvas.width = 0; canvas.height = 0; }
    if (!blob) throw new Error('EXPORT_FAILED');
    const bytes = new Uint8Array(await blob.arrayBuffer()), id = 3 + i * 3;
    const w = page.pdfWidth, h = page.pdfHeight;
    if (![width, height, w, h].every(n => Number.isFinite(n) && n > 0)) throw new Error('EXPORT_FAILED');
    object(id, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Image ${id + 2} 0 R >> >> /Contents ${id + 1} 0 R >>`);
    const stream = `q ${w} 0 0 ${h} 0 0 cm /Image Do Q`;
    object(id + 1, `<< /Length ${encode(stream).length} >>\nstream\n${stream}\nendstream`);
    offsets[id + 2] = length;
    append(encode(`${id + 2} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`));
    append(bytes); append(encode('\nendstream\nendobj\n'));
    if (length > 100 * 1024 * 1024) throw new Error('OUTPUT_LIMIT');
  }
  const start = length, count = 3 + pages.length * 3;
  append(encode(`xref\n0 ${count}\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`));
  return new Blob(chunks, { type: 'application/pdf' });
}
