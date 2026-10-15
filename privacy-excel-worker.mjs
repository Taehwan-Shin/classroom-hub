import * as XLSX from './vendor/sheetjs/xlsx.mjs';
import { sanitizeWorkbook, LIMITS } from './privacy-detect.mjs';
import { checkZip } from './privacy-zip.mjs';
// A parser diagnostic must never echo document values into developer logs.
for (const method of ['log', 'warn', 'error', 'info', 'debug']) console[method] = () => {};
self.onmessage = ({ data }) => {
  try {
    const bytes = new Uint8Array(data.buffer);
    if (!bytes.length || bytes.length > LIMITS.bytes) throw new Error('FILE_LIMIT');
    const zip = bytes[0] === 0x50 && bytes[1] === 0x4b;
    const ole = bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
    if (!zip && !ole) throw new Error('FORMAT');
    if (zip) checkZip(bytes);
    const book = XLSX.read(bytes, { type: 'array', cellFormula: true, cellHTML: false, cellStyles: false, bookVBA: false, WTF: true });
    const { output, findings, totalCells, removedFormulas } = sanitizeWorkbook(book, XLSX, data.terms);
    const buffer = XLSX.write(output, { type: 'array', bookType: 'xlsx', compression: true, bookSST: false });
    self.postMessage({ buffer, findings, totalCells, removedFormulas, sheets: output.SheetNames.length }, [buffer]);
  } catch (error) {
    const safe = ['FILE_LIMIT', 'SHEET_LIMIT', 'CELL_LIMIT', 'RANGE_LIMIT', 'TEXT_LIMIT', 'HIT_LIMIT', 'FORMAT'];
    self.postMessage({ error: safe.includes(error.message) ? error.message : 'EXCEL_FAILED' });
  }
};
