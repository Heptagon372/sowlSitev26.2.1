/* 사이트 상수 — 동적 데이터(모집 기간·자랑 숫자)는 반드시 API에서 가져온다 */

export const SITE = {
  name: 'SLEEPY OWL',
  short: 'S.OWL',
  school: '성공회대학교',
  apiBase: import.meta.env.VITE_API_BASE ?? 'http://localhost:3001/api',
  // 서버가 죽어 있을 때를 위한 백업 링크 (14기 주소 — 15기용 교체 필요)
  googleFormUrl:
    import.meta.env.VITE_GOOGLE_FORM_URL ?? 'https://forms.gle/Rap3Q3VGTwa9fKZCA',
  email: 's.owl.contact@gmail.com',
  github: 'https://github.com/skhu-Sowl',
  instagram: 'https://www.instagram.com/skhu_s.owl',
  room: '나눔관 지하 1층',
  president: '이민용', // 14기 기준 — 확인 필요
  vicePresident: '송대원', // 14기 기준 — 확인 필요
  generationFallback: 15,
  // API 다운 시 카운트다운 폴백 (임시 모집 기간)
  fallbackStartsAt: '2026-08-01T00:00:00+09:00',
  fallbackEndsAt: '2026-09-06T23:59:59+09:00',
} as const;
