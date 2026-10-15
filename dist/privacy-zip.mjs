// Cheap ZIP directory limits before handing compressed Office input to the parser.
// This bounds declared expansion, not a proof against every malformed archive.
export function checkZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { end = i; break; }
  }
  if (end < 0 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) throw new Error('FORMAT');
  const count = view.getUint16(end + 10, true), directorySize = view.getUint32(end + 12, true), offset = view.getUint32(end + 16, true);
  if (!count || count > 4000 || offset + directorySize !== end || view.getUint16(end + 8, true) !== count) throw new Error('FORMAT');
  let pos = offset, expanded = 0;
  for (let n = 0; n < count; n++) {
    if (pos + 46 > end || view.getUint32(pos, true) !== 0x02014b50) throw new Error('FORMAT');
    const flags = view.getUint16(pos + 8, true), method = view.getUint16(pos + 10, true);
    const packed = view.getUint32(pos + 20, true), raw = view.getUint32(pos + 24, true);
    if (flags & 1 || ![0, 8].includes(method)) throw new Error('FORMAT');
    expanded += raw;
    if (raw > 32 * 1024 * 1024 || expanded > 64 * 1024 * 1024 || raw > Math.max(1024 * 1024, packed * 500)) throw new Error('OUTPUT_LIMIT');
    pos += 46 + view.getUint16(pos + 28, true) + view.getUint16(pos + 30, true) + view.getUint16(pos + 32, true);
  }
  if (pos !== end) throw new Error('FORMAT');
}
