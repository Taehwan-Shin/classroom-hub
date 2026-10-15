import { customTerms, LIMITS } from './privacy-detect.mjs';
import { createPrivacyPdf, paintPage } from './privacy-pdf.mjs';
import { imageOnlyPdf } from './privacy-pdf-export.mjs';
const messages = { FILE_LIMIT: '15MB 이하의 파일 한 개를 선택해 주세요.', FORMAT: '파일의 실제 형식을 확인해 주세요. PDF·XLSX·XLS만 지원합니다.',
  TERMS_LIMIT: '직접 지정은 한 줄에 한 값, 최대 200개·각 100자까지 가능합니다.', PAGE_LIMIT: 'PDF는 30쪽 이하, 표준 크기의 문서만 처리할 수 있습니다.',
  SHEET_LIMIT: '엑셀은 1~30개 시트까지 지원합니다.', CELL_LIMIT: '엑셀은 전체 10만 셀까지 지원합니다.', RANGE_LIMIT: '각 시트는 1만 행·256열 이내여야 합니다.',
  TEXT_LIMIT: '문서의 텍스트 용량이 처리 한도를 넘었습니다.', HIT_LIMIT: '탐지 후보가 너무 많습니다. 문서를 나누어 검사해 주세요.',
  OUTPUT_LIMIT: '메모리 보호를 위해 중단했습니다. 문서를 더 작게 나누어 주세요.', PASSWORD: '암호가 걸린 문서는 지원하지 않습니다. 원본의 복사본에서 암호를 해제한 뒤 사용해 주세요.',
  OCR_UNAVAILABLE: 'OCR 초기화 또는 인식에 실패했습니다. 파일을 나누거나 다른 브라우저에서 다시 시도해 주세요.',
  TIMEOUT: '처리 시간이 초과되었습니다. 파일을 더 작게 나누어 주세요.', CANCELED: '처리를 취소하고 문서 상태를 지웠습니다.',
  PDF_FAILED: 'PDF를 읽지 못했습니다. 손상·지원하지 않는 기능 여부를 확인해 주세요.', EXCEL_FAILED: '엑셀을 읽지 못했습니다. 암호·손상·지원하지 않는 기능 여부를 확인해 주세요.' };
export function renderPrivacy(main) {
  main.innerHTML = `<section class="privacy-app" aria-labelledby="privacy-title">
    <a class="privacy-back" href="#/">← 도구함</a>
    <div class="privacy-heading"><div><p class="eyebrow">LOCAL DOCUMENT CARE</p><h1 id="privacy-title" tabindex="-1">문서는 남기고,<br><span>개인정보는 가리고.</span></h1><p>PDF와 엑셀을 이 브라우저에서 점검하고<br>원문이 제거된 새 파일로 내려받으세요.</p></div><div class="privacy-seal" aria-hidden="true"><span>✳</span>기기 안에서<br>처리합니다</div></div>
    <div class="privacy-badges"><span>↗ 파일 전송 없음</span><span>○ 자동 저장 없음</span><span>✓ 설치·로그인 없음</span></div>
    <div class="privacy-layout"><aside class="privacy-panel privacy-input"><p class="eyebrow">01 · 문서 선택</p><h2>가볍게 올려두세요</h2>
      <label class="privacy-drop" for="privacy-file"><span aria-hidden="true">▤</span><strong>PDF · Excel 파일 선택</strong><span>또는 이곳에 끌어놓기</span><small>PDF / .xlsx / .xls · 최대 15MB</small></label><input id="privacy-file" type="file" accept=".pdf,.xlsx,.xls" aria-describedby="privacy-file-state"><p id="privacy-file-state">선택한 파일이 없습니다. 파일명은 표시하지 않습니다.</p>
      <label for="privacy-terms"><strong>꼭 가릴 값 추가</strong><small>자동으로 찾기 어려운 이름·학번·주소 등을 한 줄에 하나씩 입력하세요. 입력값도 저장되지 않습니다.</small></label>
      <textarea id="privacy-terms" rows="5" maxlength="20200" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="한 줄에 한 값 · 최대 200개"></textarea>
      <p class="privacy-small">주민·외국인등록번호, 전화번호, 이메일 및 ‘이름·학번’ 표기 뒤의 값을 찾습니다. 엑셀은 개인정보 머리글 아래의 열도 가립니다.</p>
      <button type="button" id="privacy-scan" class="privacy-primary" disabled>개인정보 점검하기 →</button><button type="button" id="privacy-clear" class="privacy-secondary">취소하고 모두 지우기</button>
    </aside><div class="privacy-results"><section class="privacy-panel"><p class="eyebrow">02 · 검토 & 비식별화</p><h2>마지막 확인은 직접</h2><p id="privacy-status" role="status" aria-live="polite">문서를 선택하면 탐지 후보와 미리보기가 여기에 표시됩니다.</p>
      <div id="privacy-summary" class="privacy-summary" hidden></div><div id="privacy-findings" class="privacy-findings" hidden></div>
      <div id="privacy-preview" hidden><div class="privacy-toolbar"><button type="button" id="privacy-prev">← 이전</button><span id="privacy-page"></span><button type="button" id="privacy-next">다음 →</button></div>
        <label class="privacy-check"><input type="checkbox" id="privacy-original"> 원본을 화면에 표시 (주변 노출 주의)</label><p class="privacy-small">화면에서 드래그하여 가림 영역을 추가하세요. 터치도 지원합니다. 키보드 사용 시 ‘이 쪽 전체 가리기’를 선택할 수 있습니다.</p>
        <div class="privacy-canvas-wrap"><canvas id="privacy-canvas" aria-label="PDF 미리보기. 드래그하여 가릴 영역 추가"></canvas><div id="privacy-rect" hidden></div></div>
        <div class="privacy-toolbar"><button type="button" id="privacy-mask-page">이 쪽 전체 가리기</button><button type="button" id="privacy-undo">직접 가림 한 번 취소</button></div></div>
      <div id="privacy-download-area" hidden><label class="privacy-check"><input type="checkbox" id="privacy-reviewed"> 모든 쪽·시트의 누락 가능성을 확인했습니다. 자동 탐지 결과만으로 개인정보가 모두 제거됐다고 판단하지 않습니다.</label><button type="button" id="privacy-download" class="privacy-primary" disabled>비식별 파일 내려받기 ↓</button><p class="privacy-small">원본은 변경하지 않습니다. 내려받은 파일은 자동 암호화되지 않습니다.</p></div>
    </section><section class="privacy-notes"><h2>알아두세요</h2><p><strong>PDF</strong> · 매 쪽을 OCR과 텍스트로 점검합니다. 가린 화면만 새 PDF에 넣어 원래 텍스트·메모·첨부·메타데이터를 복사하지 않습니다. 검색·텍스트 선택·접근성 정보는 사라지고 용량이 커질 수 있습니다. 후보가 있는 줄·텍스트 묶음을 넓게 가리므로 주변 내용도 제거될 수 있습니다.</p><p><strong>Excel</strong> · 숨김 행·열·시트도 점검하고 모든 시트를 보이는 상태로 새 XLSX에 넣습니다. 시트명은 일반 이름으로 바꾸며 수식은 ‘[수식 제거]’로 바꿉니다. 서식·병합·차트·이미지·메모·링크·매크로·문서 속성은 제거합니다.</p><p><strong>탐지 한계</strong> · 손글씨·사진 속 작은 글씨·주소·임의의 학번·이름은 놓칠 수 있습니다. 학년·반·성적 등 다른 정보와 결합한 재식별 위험도 직접 검토하세요. 가림 후보가 0개여도 안전을 보장하지 않습니다.</p><p>파일과 직접 지정값은 메모리에서만 사용합니다. 모두 지우기·도구함 이동·새로고침으로 참조를 폐기하며 메모리의 보안 삭제까지 보장하지는 않습니다.</p></section></div></div></section>`;
  const $ = id => main.querySelector(`#privacy-${id}`);
  let file = null, pages = [], excel = null, worker = null, reader = null, epoch = 0, previewEpoch = 0, pageIndex = 0, timer = null, disposed = false, busy = false, dirty = false, drag = null, rejectJob = null;
  const urls = new Set();
  function status(text) { if (!disposed) $('status').textContent = text; }
  function unlock() { busy = false; clearTimeout(timer); $('scan').disabled = !file; $('file').disabled = false; $('terms').disabled = false; }
  function reset(keepFile = false) {
    epoch++; previewEpoch++; clearTimeout(timer); worker?.terminate(); worker = null; rejectJob?.(new Error('CANCELED')); rejectJob = null; reader?.cancel(); reader = null; pages = []; excel = null; drag = null;
    $('rect').hidden = true; $('canvas').width = 0; $('canvas').height = 0;
    for (const url of urls) URL.revokeObjectURL(url); urls.clear();
    for (const id of ['preview', 'summary', 'findings', 'download-area']) $(id).hidden = true;
    $('findings').replaceChildren(); $('summary').textContent = ''; $('reviewed').checked = false; $('original').checked = false; $('download').disabled = true;
    if (!keepFile) { file = null; $('file').value = ''; $('terms').value = ''; $('file-state').textContent = '선택한 파일이 없습니다. 파일명은 표시하지 않습니다.'; }
    dirty = false; unlock();
  }
  const fail = code => { if (disposed) return; reset(true); status(messages[code] || '처리에 실패했습니다. 결과 파일은 생성하지 않았습니다.'); };
  function choose(candidate) {
    reset();
    if (!candidate) return;
    if (!candidate.size || candidate.size > LIMITS.bytes) { status(messages.FILE_LIMIT); return; }
    if (!/\.(pdf|xlsx|xls)$/i.test(candidate.name)) { status(messages.FORMAT); return; }
    file = candidate; $('file-state').textContent = `${/\.pdf$/i.test(file.name) ? 'PDF' : 'Excel'} · ${(file.size / 1024 / 1024).toFixed(2)}MB · 선택됨`;
    $('scan').disabled = false; status('직접 지정할 값을 입력한 뒤 점검해 주세요.');
  }
  $('file').addEventListener('change', event => choose(event.target.files?.[0]));
  const drop = main.querySelector('.privacy-drop');
  drop.addEventListener('dragover', event => { event.preventDefault(); drop.classList.add('is-over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
  drop.addEventListener('drop', event => { event.preventDefault(); drop.classList.remove('is-over'); if (!busy) { if (event.dataTransfer.files.length !== 1) status('한 번에 파일 한 개만 선택해 주세요.'); else choose(event.dataTransfer.files[0]); } });
  $('clear').addEventListener('click', () => { reset(); status('문서와 입력값을 지웠습니다.'); });
  function renderFindings(findings) {
    const holder = $('findings'); holder.replaceChildren(); holder.hidden = false;
    const note = document.createElement('p'); note.textContent = `원문 값은 표시하지 않습니다. 후보 ${findings.length.toLocaleString()}개${findings.length > 300 ? ' 중 처음 300개만 표시' : ''}`; holder.append(note);
    const list = document.createElement('ul');
    for (const finding of findings.slice(0, 300)) { const item = document.createElement('li'); item.textContent = `${finding.location} · ${finding.type} · [가림]`; list.append(item); }
    holder.append(list);
  }
  async function preview() {
    if (!pages.length || disposed) return;
    const drawId = ++previewEpoch, page = pages[pageIndex], original = $('original').checked;
    $('page').textContent = `${pageIndex + 1} / ${pages.length}쪽 · 가림 ${page.masks.length + page.manual.length}영역`;
    $('prev').disabled = pageIndex === 0; $('next').disabled = pageIndex === pages.length - 1;
    const image = await paintPage(page, original);
    try { if (drawId !== previewEpoch || disposed) return;
      const canvas = $('canvas'); canvas.width = page.width; canvas.height = page.height; canvas.getContext('2d').drawImage(image, 0, 0);
    } finally { image.width = 0; image.height = 0; }
  }
  const redraw = () => { void preview().catch(() => fail('EXPORT_FAILED')); };
  function invalidateReview() { $('reviewed').checked = false; $('download').disabled = true; }
  $('scan').addEventListener('click', async () => {
    if (!file || busy) return;
    let terms;
    try { terms = customTerms($('terms').value); } catch (error) { status(messages[error.message]); return; }
    reset(true); busy = true; $('scan').disabled = true; $('file').disabled = true; $('terms').disabled = true;
    const token = epoch;
    timer = setTimeout(() => { if (token === epoch) fail('TIMEOUT'); }, /\.pdf$/i.test(file.name) ? 600000 : 60000);
    try {
      status('기기 안에서 문서를 읽고 있습니다…');
      const buffer = await file.arrayBuffer(); if (token !== epoch) return;
      if (/\.pdf$/i.test(file.name)) {
        reader = createPrivacyPdf();
        const result = await reader.read(buffer, terms, text => { if (token === epoch) status(text); });
        if (token !== epoch) return;
        pages = result; reader = null; pageIndex = 0;
        const findings = pages.flatMap(page => page.masks.map(mask => ({ location: `${page.number}쪽`, type: mask.type })));
        $('summary').textContent = `${pages.length}쪽 · 자동 가림 ${findings.length}영역 · 직접 가림 추가 가능`;
        renderFindings(findings); $('preview').hidden = false; await preview(); if (token !== epoch) return;
        status(`점검했습니다. 모든 쪽을 넘겨 가림 누락을 확인하세요.${pages.some(p => p.noText) ? ' 글자를 인식하지 못한 쪽이 있습니다. 그림 속 정보도 직접 확인해 주세요.' : ''}`);
      } else {
        const result = await new Promise((resolve, reject) => {
          rejectJob = reject;
          worker = new Worker(new URL('./privacy-excel-worker.mjs', import.meta.url), { type: 'module' });
          worker.onmessage = ({ data }) => data.error ? reject(new Error(data.error)) : resolve(data);
          worker.onerror = event => { event.preventDefault(); reject(new Error('EXCEL_FAILED')); };
          worker.postMessage({ buffer, terms }, [buffer]);
        });
        if (token !== epoch) return;
        worker.terminate(); worker = null; rejectJob = null; excel = new Blob([result.buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        $('summary').textContent = `${result.sheets}시트 · ${result.totalCells.toLocaleString()}셀 · 탐지 ${result.findings.length}개 · 수식 제거 ${result.removedFormulas}셀`;
        renderFindings(result.findings);
        status('숨김 시트·행·열을 포함해 점검했습니다. 원본과 탐지 위치를 비교하세요. 누락된 값은 왼쪽에 추가하고 다시 점검하세요.');
      }
      $('summary').hidden = false; $('download-area').hidden = false; unlock();
    } catch (error) { if (token === epoch) fail(error.message); }
  });
  $('terms').addEventListener('input', () => {
    if (pages.length || excel) { dirty = true; $('reviewed').checked = false; $('download').disabled = true; status('직접 지정값이 바뀌었습니다. 점검하기를 다시 눌러야 내려받을 수 있습니다.'); }
  });
  $('prev').addEventListener('click', () => { if (pageIndex > 0) { pageIndex--; redraw(); } });
  $('next').addEventListener('click', () => { if (pageIndex + 1 < pages.length) { pageIndex++; redraw(); } });
  $('original').addEventListener('change', redraw);
  $('mask-page').addEventListener('click', () => { if (!busy && pages[pageIndex]) { pages[pageIndex].manual.push({ x: 0, y: 0, w: 1, h: 1 }); invalidateReview(); redraw(); } });
  $('undo').addEventListener('click', () => { if (!busy) { pages[pageIndex]?.manual.pop(); invalidateReview(); redraw(); } });
  const canvas = $('canvas');
  const point = event => { const r = canvas.getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (event.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (event.clientY - r.top) / r.height)) }; };
  canvas.addEventListener('pointerdown', event => { if (!pages[pageIndex] || busy) return; event.preventDefault(); drag = { ...point(event), page: pageIndex, id: event.pointerId }; canvas.setPointerCapture(event.pointerId); });
  canvas.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const p = point(event), rect = $('rect'); rect.hidden = false;
    rect.style.left = `${Math.min(drag.x, p.x) * 100}%`; rect.style.top = `${Math.min(drag.y, p.y) * 100}%`;
    rect.style.width = `${Math.abs(drag.x - p.x) * 100}%`; rect.style.height = `${Math.abs(drag.y - p.y) * 100}%`;
  });
  canvas.addEventListener('pointerup', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const p = point(event), start = drag; drag = null; $('rect').hidden = true;
    if (start.page !== pageIndex) return;
    if (Math.abs(start.x - p.x) > 0.002 && Math.abs(start.y - p.y) > 0.002) {
      pages[pageIndex].manual.push({ x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(start.x - p.x), h: Math.abs(start.y - p.y) }); invalidateReview(); redraw();
    }
  });
  canvas.addEventListener('pointercancel', () => { drag = null; $('rect').hidden = true; });
  $('reviewed').addEventListener('change', () => { $('download').disabled = busy || dirty || !$('reviewed').checked; });
  $('download').addEventListener('click', async () => {
    if (busy || dirty || !$('reviewed').checked || (!pages.length && !excel)) return;
    const token = epoch; busy = true; $('download').disabled = true; $('scan').disabled = true; $('file').disabled = true; $('terms').disabled = true;
    // Freeze masks for a consistent output, even if the review UI is used during export.
    const snapshot = pages.map(p => ({ ...p, masks: [...p.masks], manual: [...p.manual] }));
    try {
      status('원문 구조를 복사하지 않고 새 파일을 만들고 있습니다…');
      const blob = snapshot.length ? await imageOnlyPdf(snapshot, page => { if (token !== epoch) throw new Error('CANCELED'); return paintPage(page); }) : excel;
      if (token !== epoch || disposed) return;
      const url = URL.createObjectURL(blob); urls.add(url);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = snapshot.length ? 'redacted-document.pdf' : 'redacted-workbook.xlsx';
      anchor.click();
      setTimeout(() => { URL.revokeObjectURL(url); urls.delete(url); }, 30000);
      status('비식별 파일을 만들었습니다. 내려받은 파일을 직접 열어 최종 확인해 주세요.');
    } catch (error) { if (token === epoch) { status(messages[error.message] || '파일 생성에 실패했습니다. 다운로드하지 않았습니다.'); } }
    finally { if (token === epoch && !disposed) { unlock(); $('download').disabled = dirty || !$('reviewed').checked; } }
  });
  return () => { reset(); disposed = true; };
}
