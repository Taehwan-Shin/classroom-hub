export function renderHub(main, tools) {
  // This template contains only developer-authored markup. Tool text is inserted safely below.
  main.innerHTML = `
    <section class="hub-intro" aria-labelledby="hub-title">
      <p class="eyebrow">선생님을 위한 작은 도구들</p>
      <h1 id="hub-title" tabindex="-1">수업에 필요한 도구,<br><span class="marker-line">한곳에</span> 모아두세요.</h1>
      <p class="intro-copy">준비는 가볍게, 수업은 여유롭게.<br>오늘 필요한 도구를 꺼내 쓰세요.</p>
      <span class="star-sticker" aria-hidden="true">✳</span>
    </section>
    <section class="tools-section" aria-labelledby="tools-title">
      <div class="section-heading"><h2 id="tools-title">나의 수업 도구</h2><span class="tool-count"></span></div>
      <div class="tool-grid"></div>
      <p class="collection-note">도구함은 앞으로도 하나씩 채워집니다.</p>
    </section>`;
  main.querySelector('.tool-count').textContent = `${tools.length}개의 도구`;
  const grid = main.querySelector('.tool-grid');
  for (const tool of tools) {
    const card = document.createElement('a');
    card.className = 'tool-card';
    card.href = tool.route;
    card.innerHTML = `<div class="card-copy"><span class="tag"></span><h3></h3><p></p><span class="card-action">도구 열기 <span aria-hidden="true">↗</span></span></div>
      <div class="timer-illustration" aria-hidden="true"><span class="illustration-caption">시간을 함께 보세요</span><div class="notebook"><span class="notebook-label">classroom timer</span><span class="sample-time">05:00</span><span class="notebook-line"></span><span class="sample-caption">우리의 집중 시간</span></div><span class="sparkle">✦</span></div>`;
    card.querySelector('.tag').textContent = tool.category || '수업 도구';
    card.querySelector('h3').textContent = tool.title;
    card.querySelector('.card-copy p').textContent = tool.description;
    if (tool.id === 'pdf-inspector') {
      card.querySelector('.timer-illustration').innerHTML = '<span class="illustration-caption">문서도 기기 안에서</span><div class="notebook pdf-notebook"><span class="notebook-label">local document check</span><span class="sample-document">가나다 <span aria-hidden="true">✓</span></span><span class="notebook-line"></span><span class="sample-caption">글자 수 · 교정 후보 · 엑셀</span></div><span class="sparkle">✦</span>';
    }
    if (tool.id === 'polynomial-forest') {
      card.querySelector('.timer-illustration').innerHTML = '<span class="illustration-caption">공통수학1 · 다항식</span><div class="notebook"><span class="notebook-label">polynomial forest</span><span class="forest-card-animals" aria-hidden="true">🐿️ 🐢</span><span class="notebook-line"></span><span class="sample-caption">이동 · 점프 · 퀴즈 · 뱃지</span></div><span class="sparkle">✦</span>';
    }
    grid.append(card);
  }
  if (!tools.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = '아직 등록된 도구가 없습니다. 개발 담당자가 도구 목록에 추가할 수 있습니다.';
    grid.append(empty);
  }
}
