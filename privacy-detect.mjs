// Conservative candidates, never a guarantee of anonymity. No telemetry or persistence.
export const LIMITS = Object.freeze({ bytes: 15 * 1024 * 1024, pages: 30, cells: 100000, text: 2000000, hits: 12000 });
export function customTerms(text = '') {
  const terms = [...new Set(text.split(/\r?\n/).map(s => s.trim()).filter(Boolean))];
  if (terms.length > 200 || terms.some(s => s.length > 100)) throw new Error('TERMS_LIMIT');
  return terms;
}
export function detect(text, terms = [], field = '') {
  text = String(text ?? '');
  if (text.length > LIMITS.text) throw new Error('TEXT_LIMIT');
  const hits = [];
  const add = (start, end, type) => { if (end > start) hits.push({ start, end, type }); };
  const patterns = [
    ['주민·외국인등록번호 후보', /(?<!\d)\d{6}[\s-]*[1-8]\d{6}(?!\d)/g],
    ['전화번호 후보', /(?<!\d)(?:\+82[\s.-]?(?:0)?1[016789]|01[016789]|0(?:2|[3-6]\d|70))[\s().-]*\d{3,4}[\s.-]*\d{4}(?!\d)/g],
    ['이메일 후보', /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)+/gi],
    ['이름 후보', /(?:성\s*명|이\s*름|학생명|보호자명|담임명)\s*[:：=]?\s*([가-힣]{2,5}|[A-Za-z]+(?:[ -][A-Za-z]+){0,3})/g],
    ['학번 후보', /(?:학\s*번|학생\s*번호|student\s*id)\s*[:：=]?\s*([A-Za-z0-9-]{2,20})/gi]
  ];
  for (const [type, re] of patterns) for (const match of text.matchAll(re)) {
    const offset = match[1] ? match[0].lastIndexOf(match[1]) : 0;
    add(match.index + offset, match.index + match[0].length, type);
  }
  const header = String(field).replace(/\s/g, '').toLowerCase();
  if (/^(성명|이름|학생명|보호자명|담임명|name|학번|학생번호|studentid|전화|전화번호|연락처|휴대폰|주민번호|주민등록번호|외국인등록번호|이메일|email)$/.test(header) && text.trim()) add(0, text.length, '개인정보 열');
  for (const term of terms) {
    let from = 0, start;
    while ((start = text.indexOf(term, from)) !== -1) { add(start, start + term.length, '직접 지정'); from = start + term.length; }
  }
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged = [];
  for (const hit of hits) {
    const last = merged.at(-1);
    if (last && hit.start < last.end) last.end = Math.max(last.end, hit.end);
    else merged.push({ ...hit });
  }
  if (merged.length > LIMITS.hits) throw new Error('HIT_LIMIT');
  return merged;
}
export function replaceHits(text, hits) {
  let result = '', end = 0;
  for (const hit of hits) { result += text.slice(end, hit.start) + '[삭제]'; end = hit.end; }
  return result + text.slice(end);
}
export function sanitizeWorkbook(book, XLSX, terms = []) {
  if (!book.SheetNames.length || book.SheetNames.length > 30) throw new Error('SHEET_LIMIT');
  const output = XLSX.utils.book_new(), findings = [];
  let totalCells = 0, textSize = 0, totalHits = 0, removedFormulas = 0;
  for (const [sheetIndex, name] of book.SheetNames.entries()) {
    const source = book.Sheets[name], target = {}, headers = new Map();
    // Inspect stored cells, including hidden rows/columns and cells outside a forged !ref.
    const addresses = Object.keys(source).filter(k => /^[A-Z]{1,3}[1-9]\d{0,6}$/.test(k));
    if ((totalCells += addresses.length) > LIMITS.cells) throw new Error('CELL_LIMIT');
    addresses.sort((a, b) => { const x = XLSX.utils.decode_cell(a), y = XLSX.utils.decode_cell(b); return x.r - y.r || x.c - y.c; });
    let minR = Infinity, minC = Infinity, maxR = 0, maxC = 0;
    for (const address of addresses) {
      const point = XLSX.utils.decode_cell(address), cell = source[address];
      if (point.r >= 10000 || point.c >= 256) throw new Error('RANGE_LIMIT');
      minR = Math.min(minR, point.r); maxR = Math.max(maxR, point.r); minC = Math.min(minC, point.c); maxC = Math.max(maxC, point.c);
      if (cell.f || cell.F) { target[address] = { t: 's', v: '[수식 제거]' }; removedFormulas++; continue; }
      const value = cell.w ?? cell.v ?? '';
      const text = String(value);
      if ((textSize += text.length) > LIMITS.text) throw new Error('TEXT_LIMIT');
      if (text.length > 32767) throw new Error('TEXT_LIMIT');
      const hits = detect(text, terms, headers.get(point.c) || '');
      // Scientific/custom number formats can conceal a sensitive underlying value.
      const rawText = String(cell.v ?? '');
      const rawHits = rawText !== text ? detect(rawText, terms, headers.get(point.c) || '') : [];
      if (rawHits.length && !hits.length) hits.push({ start: 0, end: text.length, type: '원시 값 개인정보 후보' });
      if ((totalHits += hits.length) > LIMITS.hits) throw new Error('HIT_LIMIT');
      for (const hit of hits) findings.push({ location: `시트 ${sheetIndex + 1} · ${address}`, type: hit.type });
      const compact = text.replace(/\s/g, '').toLowerCase();
      if (/^(성명|이름|학생명|보호자명|담임명|name|학번|학생번호|studentid|전화|전화번호|연락처|휴대폰|주민번호|주민등록번호|외국인등록번호|이메일|email)$/.test(compact)) headers.set(point.c, compact);
      // Everything becomes a literal value. Formulas, links, comments, images and properties are never copied.
      target[address] = hits.length ? { t: 's', v: rawHits.length ? '[삭제]' : replaceHits(text, hits) } : (cell.t === 'n' && typeof cell.v === 'number' && Number.isFinite(cell.v) && text === rawText && !cell.z ? { t: 'n', v: cell.v } : { t: 's', v: text });
    }
    target['!ref'] = minR === Infinity ? 'A1' : XLSX.utils.encode_range({ s: { r: minR, c: minC }, e: { r: maxR, c: maxC } });
    XLSX.utils.book_append_sheet(output, target, `시트 ${sheetIndex + 1}`);
  }
  return { output, findings, totalCells, removedFormulas };
}
