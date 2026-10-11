export const tools = Object.freeze([
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
    "route": "#/polynomial",
    "category": "수학 학습 게임"
  }
].map(Object.freeze));

export function validateTools(list, routes) {
  const ids = new Set(), paths = new Set();
  return list.filter(tool => {
    if (!tool || typeof tool.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(tool.id) ||
        typeof tool.title !== 'string' || !tool.title || typeof tool.description !== 'string' ||
        !routes.has(tool.route) || ids.has(tool.id) || paths.has(tool.route)) return false;
    ids.add(tool.id); paths.add(tool.route);
    return true;
  });
}
