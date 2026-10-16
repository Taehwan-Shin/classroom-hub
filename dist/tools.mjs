export const tools = Object.freeze([
  {
    "id": "privacy-redactor",
    "title": "개인정보 점검 · 비식별화",
    "description": "PDF·엑셀의 개인정보를 기기 안에서 찾고, 가린 새 파일로 받으세요.",
    "route": "#/privacy",
    "category": "개인정보 보호"
  },
  {
    "id": "classroom-timer",
    "title": "교실 타이머",
    "description": "활동 시간을 정하고, 남은 시간을 함께 보세요.",
    "route": "#/timer",
    "category": "시간 관리"
  },
  {
    "id": "pdf-inspector",
    "title": "PDF 글자 수 · 맞춤법",
    "description": "텍스트·스캔 PDF를 기기에서 검사하고 엑셀로 받으세요.",
    "route": "#/pdf",
    "category": "문서 점검"
  },
  {
    "id": "polynomial-forest",
    "title": "다항식 숲 탐험",
    "description": "다람쥐와 거북이의 점프 모험! 공통수학1 문제를 풀고 뱃지를 모으세요.",
    "route": "https://classroom-polynomial-forest.vercel.app/",
    "category": "수학 학습 게임"
  },
  {
    "id": "personal-diary",
    "title": "오늘의 일기",
    "description": "Google 계정으로 로그인하고 암호화한 일기를 보관하세요.",
    "route": "https://classroom-diary-098bae6e.web.app/#/diary",
    "category": "개인 기록"
  }
].map(Object.freeze));

export function validateTools(list, routes) {
  const external = { 'personal-diary': 'https://classroom-diary-098bae6e.web.app/#/diary', 'polynomial-forest': 'https://classroom-polynomial-forest.vercel.app/' };
  const ids = new Set(), paths = new Set();
  return list.filter(tool => {
    if (!tool || typeof tool.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(tool.id) ||
        typeof tool.title !== 'string' || !tool.title || typeof tool.description !== 'string' ||
        !(routes.has(tool.route) || external[tool.id] === tool.route) || ids.has(tool.id) || paths.has(tool.route)) return false;
    ids.add(tool.id); paths.add(tool.route);
    return true;
  });
}
