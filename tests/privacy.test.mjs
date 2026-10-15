import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as XLSX from '../dist/vendor/sheetjs/xlsx.mjs';
import { detect, replaceHits, customTerms, sanitizeWorkbook } from '../dist/privacy-detect.mjs';
import { checkZip } from '../dist/privacy-zip.mjs';
import { imageOnlyPdf } from '../dist/privacy-pdf-export.mjs';
// Entirely synthetic runtime-generated patterns; never personal fixtures or literal contact data.
const digits = length => Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
test('contact, registration and labeled identity candidates are replaced', () => {
  const phone = ['010', digits(4), digits(4)].join('-');
  const rrn = digits(6) + '-' + '1' + digits(6);
  const source = `${phone}\n${rrn}\n이름: 가상인\n학번: T${digits(7)}\nqa@example.invalid`;
  const hits = detect(source), replaced = replaceHits(source, hits);
  assert.equal(hits.length, 5); assert.ok(!replaced.includes(phone)); assert.ok(!replaced.includes(rrn)); assert.ok(!replaced.includes('가상인'));
});
test('literal terms, overlap, whitespace headers and limits', () => {
  assert.deepEqual(customTerms('가상값\n 가상값 \n'), ['가상값']);
  assert.equal(replaceHits('custom literal.*', detect('custom literal.*', ['literal.*'])), 'custom [삭제]');
  assert.equal(detect('synthetic', [], '학 번').length, 1);
  assert.equal(detect('일반적인 문서 내용').length, 0);
  assert.throws(() => customTerms('x'.repeat(101)), /TERMS_LIMIT/);
});
test('hidden sheets, values outside ref, formulas, comments and original metadata are not copied', () => {
  const book = XLSX.utils.book_new(), sheet = XLSX.utils.aoa_to_sheet([['이름', '학번', '메모'], ['가상인', digits(8), '=literal']]);
  sheet.A2.c = [{ a: 'synthetic', t: 'do not copy' }]; sheet.A2.l = { Target: 'https://example.invalid' };
  sheet.D2 = { t: 'n', v: 999, f: '1+1' }; sheet.Z9 = { t: 's', v: '가상값' };
  sheet['!rows'] = [{ hidden: true }]; sheet['!cols'] = [{ hidden: true }];
  XLSX.utils.book_append_sheet(book, sheet, 'private synthetic sheet');
  book.Workbook = { Sheets: [{ Hidden: 2 }] }; book.Props = { Author: 'synthetic-private' };
  const result = sanitizeWorkbook(book, XLSX, ['가상값']);
  const out = result.output, target = out.Sheets[out.SheetNames[0]];
  assert.equal(target.A2.v, '[삭제]'); assert.equal(target.B2.v, '[삭제]'); assert.equal(target.Z9.v, '[삭제]'); assert.equal(target.D2.v, '[수식 제거]');
  assert.equal(target.C2.t, 's'); assert.equal(target.C2.v, '=literal'); assert.equal(target.A2.c, undefined); assert.equal(target.A2.l, undefined);
  assert.equal(target['!rows'], undefined); assert.equal(out.Props, undefined); assert.equal(out.SheetNames[0], '시트 1');
  const buffer = XLSX.write(out, { type: 'array', bookType: 'xlsx', compression: true }); checkZip(new Uint8Array(buffer));
  const roundtrip = XLSX.read(buffer, { type: 'array' }); assert.equal(roundtrip.Sheets['시트 1'].C2.f, undefined);
});
test('oversized coordinates and invalid zip fail closed', () => {
  const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, { A10001: { t: 's', v: 'synthetic' }, '!ref': 'A1' }, 'a');
  assert.throws(() => sanitizeWorkbook(book, XLSX), /RANGE_LIMIT/); assert.throws(() => checkZip(new Uint8Array(40)), /FORMAT/);
});
test('formatted numbers cannot retain a sensitive raw value', () => {
  const book = XLSX.utils.book_new(), raw = Number(digits(6) + '1' + digits(6));
  XLSX.utils.book_append_sheet(book, { A1: { t: 'n', v: raw, w: 'hidden by format' }, '!ref': 'A1' }, 'a');
  assert.equal(sanitizeWorkbook(book, XLSX, [String(raw)]).output.Sheets['시트 1'].A1.v, '[삭제]');
});
test('PDF writer builds a new object graph with a correct cross reference', async () => {
  const bytes = new Uint8Array([255, 216, 255, 217]);
  const blob = await imageOnlyPdf([{ pdfWidth: 200, pdfHeight: 300 }], async () => ({ width: 100, height: 150, toBlob: callback => callback(new Blob([bytes])) }));
  const text = new TextDecoder().decode(await blob.arrayBuffer());
  assert.ok(text.includes('/Subtype /Image')); assert.ok(!text.includes('/Annots')); assert.ok(!text.includes('/EmbeddedFiles')); assert.ok(!text.includes('/Font'));
  const start = Number(text.match(/startxref\n(\d+)/)[1]); assert.equal(text.slice(start, start + 4), 'xref');
});
test('privacy UI contains no persistence, upload, unsafe insertion or raw logging', async () => {
  for (const name of ['privacy-view.mjs', 'privacy-pdf.mjs', 'privacy-excel-worker.mjs']) {
    const source = await readFile(new URL(`../dist/${name}`, import.meta.url), 'utf8');
    const reviewed = source.replace('async fetch({ kind, filename })', 'async localData({ kind, filename })');
    assert.ok(!/\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon|localStorage|indexedDB|sessionStorage)\b/.test(reviewed));
    assert.ok(!/console\.(?:log|warn|error)\(/.test(source));
  }
});
