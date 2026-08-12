/**
 * 회원 전용 공간 라우트 레지스트리 (설계도 ② §5-1)
 * 9개 카테고리 · 총 30페이지. 라우트·권한·레이아웃은 처음부터 전부 잡되,
 * 내용은 1차→2차→3차로 나눠 구현한다. 미구현은 '준비 중' 플레이스홀더.
 *
 * 파일은 카테고리별 폴더로 나눠 둔다 (/member/<dir>/<file>.html).
 * 폴더명은 URL에 그대로 드러나므로 ASCII 슬러그를 쓴다 — 한글 경로는
 * 퍼센트 인코딩되어 링크가 지저분해지고, 이 저장소는 한글 경로 때문에
 * 이미 한 번 도구가 깨진 적이 있다(README '알아둘 것' 참고).
 */

export interface MemberPage {
  id: string;
  dir: string; // '' = /member 루트
  file: string; // <id>.html
  label: string;
  group: string;
  stage: 1 | 2 | 3;
  implemented: boolean;
  desc: string;
}

/** 카테고리(사이드바 그룹) → 폴더 슬러그 */
export const GROUP_DIRS: Array<{ group: string; dir: string }> = [
  { group: '홈', dir: '' },
  { group: '공지', dir: 'notice' },
  { group: '학습', dir: 'study' },
  { group: '프로젝트', dir: 'project' },
  { group: '커뮤니티', dir: 'community' },
  { group: '기록', dir: 'record' },
  { group: '회원', dir: 'people' },
  { group: '운영', dir: 'ops' },
  { group: '도구', dir: 'tools' },
];

export const MEMBER_GROUPS = GROUP_DIRS.map((g) => g.group);

type PageSeed = Omit<MemberPage, 'dir' | 'file'>;

const SEEDS: PageSeed[] = [
  // A. 홈
  { id: 'index', label: '대시보드', group: '홈', stage: 1, implemented: true, desc: '내 일정·과제·공지 요약' },
  // B. 공지
  { id: 'notices', label: '공지사항', group: '공지', stage: 1, implemented: true, desc: '목록·상세, 상단 고정, 읽음 표시' },
  { id: 'calendar', label: '동아리 일정', group: '공지', stage: 1, implemented: true, desc: '월간 캘린더, iCal 내보내기' },
  { id: 'events', label: '동아리 행사', group: '공지', stage: 3, implemented: true, desc: '행사 목록, 참가 신청/취소' },
  // C. 학습
  { id: 'studies', label: '스터디', group: '학습', stage: 2, implemented: true, desc: '스터디 개설·모집·참여, 주차별 진행' },
  { id: 'study-files', label: '스터디 자료실', group: '학습', stage: 2, implemented: true, desc: '스터디별 파일 업로드·다운로드' },
  { id: 'seminars', label: '세미나', group: '학습', stage: 2, implemented: true, desc: '발표 일정, 발표자 신청, 슬라이드' },
  { id: 'seminar-attendance', label: '세미나 출석', group: '학습', stage: 2, implemented: true, desc: '출석 코드 체크, 개인 출석률' },
  { id: 'missions', label: '과제 / 미션', group: '학습', stage: 2, implemented: true, desc: '과제 목록·제출·마감·피드백' },
  { id: 'files', label: '자료실', group: '학습', stage: 1, implemented: true, desc: '동아리 공용 자료' },
  // D. 프로젝트
  { id: 'projects', label: '프로젝트', group: '프로젝트', stage: 2, implemented: true, desc: '진행 중/완료 프로젝트 목록' },
  { id: 'project-manage', label: '프로젝트 관리', group: '프로젝트', stage: 3, implemented: true, desc: '칸반 보드, 마일스톤' },
  { id: 'recruiting', label: '팀원 모집', group: '프로젝트', stage: 2, implemented: true, desc: '모집글, 포지션·기술스택 필터, 지원' },
  { id: 'github', label: 'GitHub 연동', group: '프로젝트', stage: 3, implemented: true, desc: '커밋·PR 활동 표시' },
  { id: 'hackathon', label: '해커톤', group: '프로젝트', stage: 3, implemented: true, desc: '회차 정보, 팀 편성' },
  { id: 'portfolio', label: '포트폴리오', group: '프로젝트', stage: 3, implemented: true, desc: '완성작 갤러리' },
  // E. 커뮤니티
  { id: 'community', label: '커뮤니티', group: '커뮤니티', stage: 3, implemented: true, desc: '게시판 허브' },
  { id: 'board', label: '자유게시판', group: '커뮤니티', stage: 1, implemented: true, desc: '글 작성·댓글·좋아요' },
  { id: 'qna', label: '질문 / Q&A', group: '커뮤니티', stage: 2, implemented: true, desc: '질문·답변, 채택, 태그' },
  { id: 'chat', label: '채팅', group: '커뮤니티', stage: 3, implemented: true, desc: '실시간 채팅 (WebSocket)' },
  { id: 'polls', label: '설문 / 투표', group: '커뮤니티', stage: 2, implemented: true, desc: '설문 생성·응답·결과 그래프' },
  // F. 기록
  { id: 'activities', label: '활동 기록', group: '기록', stage: 2, implemented: true, desc: '동아리 전체 활동 타임라인' },
  { id: 'my-activities', label: '내 활동 기록', group: '기록', stage: 2, implemented: true, desc: '내 참여 이력·출석·제출물' },
  { id: 'points', label: '포인트 / 랭킹', group: '기록', stage: 2, implemented: true, desc: '포인트 적립 내역, 기수별 랭킹' },
  { id: 'certificate', label: '수료 / 활동 인증', group: '기록', stage: 3, implemented: true, desc: '활동 확인서 PDF 발급' },
  // G. 회원
  { id: 'members', label: '회원 목록', group: '회원', stage: 1, implemented: true, desc: '부원 목록, 기수·전공 필터' },
  { id: 'profile', label: '내 프로필', group: '회원', stage: 1, implemented: true, desc: '프로필·기술스택·비밀번호' },
  // H. 운영
  { id: 'dues', label: '회비 / 운영비', group: '운영', stage: 3, implemented: true, desc: '납부 상태, 사용 내역 공개' },
  // I. 도구
  { id: 'ai', label: 'S.OWL AI', group: '도구', stage: 3, implemented: true, desc: '동아리 자료 기반 Q&A' },
  { id: 'contests', label: '공모전 확인', group: '도구', stage: 3, implemented: true, desc: '외부 공모전 목록·마감일' },
];

export const MEMBER_PAGES: MemberPage[] = SEEDS.map((s) => ({
  ...s,
  dir: GROUP_DIRS.find((g) => g.group === s.group)?.dir ?? '',
  file: `${s.id}.html`,
}));

/** 브라우저에서 열 경로 — /member/study/studies.html */
export function pagePath(p: MemberPage): string {
  return p.dir ? `/member/${p.dir}/${p.file}` : `/member/${p.file}`;
}

export function pageById(id: string): MemberPage | undefined {
  return MEMBER_PAGES.find((p) => p.id === id);
}

/** 다른 페이지로 링크할 때 — pathOf('board') → /member/community/board.html */
export function pathOf(id: string): string {
  const p = pageById(id);
  return p ? pagePath(p) : '/member/index.html';
}
