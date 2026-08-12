/* ============================================================
   @sowl/shared — 프론트엔드·백엔드 공용 타입 & 검증 규칙
   ============================================================ */

export type RecruitPhase = 'before' | 'open' | 'closed';
export type ExperienceLevel = '입문' | '초급' | '중급' | '고급';

export interface ApplicantInput {
  name: string;
  studentId: string;
  department: string;
  grade: string;
  phone: string;
  email: string;
}

export interface ApplicationInput {
  applicant: ApplicantInput;
  interests: string[];
  experience: ExperienceLevel;
  availableDays: string[];
  motivation: string;
  wantToBuild?: string | null;
  agreedToPrivacyPolicy: true;
}

export interface ApplicationResult {
  id: string;
  submittedAt: string; // ISO
  updated: boolean;
}

export interface RecruitInfo {
  generation: number;
  startsAt: string; // ISO
  endsAt: string; // ISO
  phase: RecruitPhase;
  periodText: string;
  googleFormUrl: string;
}

export interface ClubStats {
  members: number; // 35
  hasServerRack: boolean; // true
  servers: number;
  projects: number;
  generation: number;
  roomLocation: string;
}

export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
}

/** 관리자 목록 조회 항목 (개인정보 최소화 화면용) */
export interface AdminApplicationRow {
  id: string;
  generation: number;
  name: string;
  studentId: string;
  department: string;
  grade: string;
  interests: string[];
  experience: string;
  createdAt: string; // ISO
}

export interface AdminApplicationDetail extends AdminApplicationRow {
  phone: string;
  email: string;
  availableDays: string[];
  motivation: string;
  wantToBuild: string | null;
  agreedAt: string; // ISO
}

export interface AdminListResult {
  total: number;
  today: number;
  interestDist: Record<string, number>;
  items: AdminApplicationRow[];
}

/* ------------------------------------------------------------
   검증 규칙 — 프론트 검증과 백엔드 DTO가 같은 상수를 참조한다
   ------------------------------------------------------------ */
export const VALIDATION = {
  nameMin: 2,
  departmentMin: 2,
  studentIdPattern: /^\d{6,10}$/,
  phonePattern: /^01\d-\d{3,4}-\d{4}$/,
  emailPattern: /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/,
  motivationMin: 30,
  interestsMin: 1,
} as const;

export const EXPERIENCE_LEVELS: readonly ExperienceLevel[] = [
  '입문',
  '초급',
  '중급',
  '고급',
] as const;

export const EXPERIENCE_LEVEL_DESC: Record<ExperienceLevel, string> = {
  입문: '해본 적 없음',
  초급: '수업에서 조금',
  중급: '토이 프로젝트',
  고급: '협업·배포 경험',
};

export const INTEREST_OPTIONS: readonly string[] = [
  'Frontend',
  'Backend',
  'AI / ML',
  'Mobile',
  'Game',
  'Security',
  'Data',
  'Embedded',
  'Design',
  'Cloud',
] as const;

export const DAY_OPTIONS: readonly string[] = [
  '월',
  '화',
  '수',
  '목',
  '금',
  '토',
  '일',
] as const;

/** 에러 코드 — 프론트 분기용 (설계도 ② §11 규약 포함) */
export const ERROR_CODES = {
  RECRUIT_CLOSED: 'RECRUIT_CLOSED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL: 'INTERNAL',
  UNAUTHENTICATED: 'UNAUTHENTICATED', // 401 로그인 필요
  MEMBER_ONLY: 'MEMBER_ONLY', // 403 로그인했지만 GUEST
  ADMIN_ONLY: 'ADMIN_ONLY', // 403 관리자 전용
  ELEVATION_REQUIRED: 'ELEVATION_REQUIRED', // 403 DB 접근 비밀번호 필요
  STUDENT_ID_TAKEN: 'STUDENT_ID_TAKEN', // 409 이미 가입된 학번
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED', // 423 로그인 실패 초과
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/* ============================================================
   회원 시스템 (설계도 ②) — 등급 · 인증 · 회원 공간 · 관리자
   ============================================================ */

export type Role = 'GUEST' | 'MEMBER' | 'ADMIN';

/** 비밀번호 규칙 — 정확히 이 두 조건만 필수 (8자 이상 + 특수문자 1자 이상) */
export const PASSWORD_RULE = {
  minLength: 8,
  requireSpecial: true,
  specialChars: `!@#$%^&*()_+-=[]{};':"\\|,.<>/?~\``,
} as const;

const SPECIAL_RE = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/;

export function checkPassword(password: string): {
  lengthOk: boolean;
  specialOk: boolean;
  ok: boolean;
} {
  const lengthOk = password.length >= PASSWORD_RULE.minLength;
  const specialOk = SPECIAL_RE.test(password);
  return { lengthOk, specialOk, ok: lengthOk && specialOk };
}

/** 가입 검증 — 이름 2~10자 한글/영문, 아이디=학번은 입학년도(4)+5자리 = 정확히 9자리 */
export const USER_VALIDATION = {
  namePattern: /^[가-힣a-zA-Z]{2,10}$/,
  studentIdPattern: /^\d{9}$/,
} as const;

export interface SignupInput {
  name: string;
  studentId: string;
  password: string;
  email?: string | null;
  agreedToTerms: true;
}

export interface LoginInput {
  studentId: string;
  password: string;
}

/** GET /api/auth/me — 내 정보 + 등급 */
export interface SessionUser {
  id: string;
  studentId: string;
  name: string;
  role: Role;
  generation: number | null;
  email: string | null;
  department: string | null;
  bio: string | null;
  techStack: string[];
  githubLogin: string | null;
  avatarUrl: string | null;
  points: number;
  createdAt: string; // ISO
  lastLoginAt: string | null;
}

export interface ProfileUpdateInput {
  name?: string;
  email?: string | null;
  department?: string | null;
  bio?: string | null;
  techStack?: string[];
  githubLogin?: string | null;
}

/* ------------------------------------------------------------
   회원 전용 공간
   ------------------------------------------------------------ */

export interface NoticeRow {
  id: string;
  title: string;
  pinned: boolean;
  authorName: string;
  createdAt: string;
  read: boolean;
}
export interface NoticeDetail extends NoticeRow {
  body: string;
}

export interface EventRow {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  kind: string | null; // SEMINAR | STUDY | HACKATHON | ETC
  /** 3차 — 참가 신청 */
  signupOpen: boolean;
  capacity: number | null;
  signupCount: number;
  signedUpByMe: boolean;
}

export interface MemberRow {
  id: string;
  name: string;
  role: Role;
  generation: number | null;
  department: string | null;
  techStack: string[];
  githubLogin: string | null;
  bio: string | null;
  points: number;
}

export interface PostRow {
  id: string;
  title: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
}
export interface CommentRow {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}
export interface PostDetail extends PostRow {
  body: string;
  comments: CommentRow[];
}

export interface FileRow {
  id: string;
  category: string;
  name: string;
  size: number;
  mime: string;
  uploaderId: string;
  uploaderName: string;
  downloads: number;
  createdAt: string;
  /** 값이 있으면 그 스터디 전용 자료, null이면 공용 자료실 */
  studyId: string | null;
  studyTitle: string | null;
}

export const FILE_CATEGORIES: readonly string[] = [
  '스터디',
  '세미나',
  '프로젝트',
  '행정',
  '기타',
] as const;

export interface MemberDashboard {
  memberCount: number;
  notices: NoticeRow[];
  events: EventRow[];
  posts: PostRow[];
}

/* ------------------------------------------------------------
   회원 공간 2차 — 학습 · 프로젝트 · 커뮤니티 · 기록
   ------------------------------------------------------------ */

export type StudyStatus = 'RECRUITING' | 'ONGOING' | 'DONE';
export const STUDY_STATUS_LABEL: Record<StudyStatus, string> = {
  RECRUITING: '모집 중',
  ONGOING: '진행 중',
  DONE: '완료',
};

export interface StudyRow {
  id: string;
  title: string;
  description: string;
  topic: string | null;
  status: StudyStatus;
  schedule: string | null;
  maxMembers: number;
  memberCount: number;
  leaderId: string;
  leaderName: string;
  joinedByMe: boolean;
  createdAt: string;
}

export interface StudyWeekRow {
  id: string;
  weekNo: number;
  title: string;
  content: string | null;
  meetAt: string | null;
  done: boolean;
}

export interface StudyDetail extends StudyRow {
  members: Array<{ id: string; name: string; generation: number | null; isLeader: boolean }>;
  weeks: StudyWeekRow[];
  fileCount: number;
}

export interface SeminarRow {
  id: string;
  title: string;
  description: string | null;
  speakerId: string | null;
  speakerName: string | null;
  startsAt: string;
  location: string | null;
  slideUrl: string | null;
  points: number;
  attendeeCount: number;
  attendedByMe: boolean;
  /** 출석 코드가 열려 있는 동안만 true (코드 값 자체는 발표자·관리자에게만) */
  codeOpen: boolean;
  attendCode: string | null;
}

export interface AttendanceStat {
  totalSeminars: number; // 이미 지난 세미나 수
  attended: number;
  rate: number; // 0~100
  recent: Array<{ seminarId: string; title: string; startsAt: string; attended: boolean }>;
}

export interface MissionRow {
  id: string;
  title: string;
  dueAt: string;
  points: number;
  submissionCount: number;
  mySubmitted: boolean;
  myScore: number | null;
  createdAt: string;
}

export interface SubmissionRow {
  id: string;
  userId: string;
  userName: string;
  content: string;
  link: string | null;
  submittedAt: string;
  feedback: string | null;
  score: number | null;
  reviewedAt: string | null;
}

export interface MissionDetail extends MissionRow {
  body: string;
  mySubmission: SubmissionRow | null;
  /** 관리자에게만 채워진다 */
  submissions: SubmissionRow[];
}

export type ProjectStatus = 'PLANNING' | 'ONGOING' | 'DONE' | 'ARCHIVED';
export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  PLANNING: '기획 중',
  ONGOING: '진행 중',
  DONE: '완료',
  ARCHIVED: '보관',
};

export interface ProjectRow {
  id: string;
  name: string;
  summary: string;
  description: string | null;
  status: ProjectStatus;
  techStack: string[];
  repoUrl: string | null;
  demoUrl: string | null;
  generation: number | null;
  ownerId: string;
  ownerName: string;
  members: Array<{ id: string; name: string; role: string }>;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
}

export interface TeamApplicationRow {
  id: string;
  userId: string;
  userName: string;
  position: string | null;
  message: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
}

export interface TeamPostRow {
  id: string;
  title: string;
  body: string;
  positions: string[];
  techStack: string[];
  status: 'OPEN' | 'CLOSED';
  projectId: string | null;
  projectName: string | null;
  authorId: string;
  authorName: string;
  applicationCount: number;
  appliedByMe: boolean;
  createdAt: string;
  /** 글쓴이에게만 채워진다 */
  applications: TeamApplicationRow[];
}

export interface AnswerRow {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
  accepted: boolean;
}

export interface QuestionRow {
  id: string;
  title: string;
  tags: string[];
  authorId: string;
  authorName: string;
  answerCount: number;
  solved: boolean;
  views: number;
  createdAt: string;
}

export interface QuestionDetail extends QuestionRow {
  body: string;
  answers: AnswerRow[];
}

export interface PollRow {
  id: string;
  title: string;
  description: string | null;
  multiple: boolean;
  anonymous: boolean;
  closesAt: string | null;
  closed: boolean;
  authorId: string;
  authorName: string;
  createdAt: string;
  totalVoters: number;
  myVotes: string[]; // optionId 목록
  options: Array<{ id: string; label: string; count: number; percent: number }>;
}

export interface PointLogRow {
  id: string;
  delta: number;
  kind: string;
  reason: string;
  createdAt: string;
}

export interface RankingRow {
  rank: number;
  userId: string;
  name: string;
  generation: number | null;
  points: number;
  isMe: boolean;
}

export interface PointsPage {
  myPoints: number;
  myRank: number | null;
  logs: PointLogRow[];
  ranking: RankingRow[];
  generations: number[];
}

/** 활동 타임라인 항목 — 기존 테이블을 모아서 만든다 (별도 로그 테이블 없음) */
export interface ActivityItem {
  kind:
    | 'NOTICE'
    | 'SEMINAR'
    | 'MISSION'
    | 'STUDY'
    | 'PROJECT'
    | 'POST'
    | 'QUESTION'
    | 'POLL'
    | 'FILE'
    | 'EVENT';
  title: string;
  who: string | null;
  at: string;
  href: string | null;
  detail: string | null;
}

/* ------------------------------------------------------------
   회원 공간 3차 — 행사 · 칸반 · 해커톤 · 포트폴리오 · 채팅 · 회비 · 도구
   ------------------------------------------------------------ */

export const TASK_STATUSES = ['TODO', 'DOING', 'REVIEW', 'DONE'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: '할 일',
  DOING: '진행 중',
  REVIEW: '리뷰',
  DONE: '완료',
};

export interface TaskRow {
  id: string;
  title: string;
  body: string | null;
  status: TaskStatus;
  order: number;
  assigneeId: string | null;
  assigneeName: string | null;
  milestoneId: string | null;
  milestoneTitle: string | null;
  dueAt: string | null;
}

export interface MilestoneRow {
  id: string;
  title: string;
  dueAt: string | null;
  done: boolean;
  taskCount: number;
  doneCount: number;
}

export interface KanbanBoard {
  projectId: string;
  projectName: string;
  canManage: boolean;
  members: Array<{ id: string; name: string; role: string }>;
  milestones: MilestoneRow[];
  tasks: TaskRow[];
}

export type HackathonStatus = 'PLANNED' | 'OPEN' | 'ONGOING' | 'DONE';
export const HACKATHON_STATUS_LABEL: Record<HackathonStatus, string> = {
  PLANNED: '준비 중',
  OPEN: '팀 모집',
  ONGOING: '진행 중',
  DONE: '종료',
};

export interface HackathonTeamRow {
  id: string;
  name: string;
  idea: string | null;
  repoUrl: string | null;
  demoUrl: string | null;
  submittedAt: string | null;
  score: number | null;
  rank: number | null;
  members: Array<{ id: string; name: string }>;
  joinedByMe: boolean;
}

export interface HackathonRow {
  id: string;
  round: number;
  title: string;
  theme: string | null;
  description: string | null;
  startsAt: string;
  endsAt: string;
  location: string | null;
  status: HackathonStatus;
  teams: HackathonTeamRow[];
  myTeamId: string | null;
}

export interface PortfolioItem {
  id: string;
  name: string;
  summary: string;
  description: string | null;
  techStack: string[];
  repoUrl: string | null;
  demoUrl: string | null;
  thumbnailUrl: string | null;
  generation: number | null;
  status: ProjectStatus;
  ownerName: string;
  memberNames: string[];
  endedAt: string | null;
  isPublic: boolean;
  canManage: boolean;
}

export interface CommunityHub {
  posts: PostRow[];
  questions: QuestionRow[];
  polls: PollRow[];
  latestChat: Array<{ room: string; roomSlug: string; body: string; userName: string; at: string }>;
  counts: { posts: number; questions: number; polls: number; unsolved: number };
}

export interface ChatRoomRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  messageCount: number;
  lastAt: string | null;
}

export interface ChatMessageRow {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  body: string;
  createdAt: string;
}

export interface DuesTermRow {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  paidCount: number;
  memberCount: number;
  myPaidAt: string | null;
  myAmount: number;
}

export interface ExpenseRow {
  id: string;
  termId: string | null;
  termName: string | null;
  title: string;
  amount: number;
  category: string;
  spentAt: string;
  note: string | null;
}

export interface DuesPage {
  terms: DuesTermRow[];
  expenses: ExpenseRow[];
  totals: { collected: number; spent: number; balance: number };
  /** 관리자에게만 — 미납자 확인용 */
  roster: Array<{ termId: string; userId: string; name: string; paidAt: string | null }>;
}

export const EXPENSE_CATEGORIES: readonly string[] = [
  '간식',
  '장비',
  '행사',
  '서버',
  '기타',
] as const;

export interface ContestRow {
  id: string;
  title: string;
  url: string;
  host: string | null;
  category: string | null;
  prize: string | null;
  summary: string | null;
  deadline: string | null;
  source: 'MANUAL' | 'FEED';
  bookmarked: boolean;
  dday: number | null;
}

export interface ContestFeedRow {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  lastFetchedAt: string | null;
  lastError: string | null;
}

export interface GithubActivity {
  login: string;
  linked: boolean;
  profile: {
    name: string | null;
    avatarUrl: string | null;
    bio: string | null;
    followers: number;
    publicRepos: number;
    htmlUrl: string;
  } | null;
  repos: Array<{
    name: string;
    description: string | null;
    language: string | null;
    stars: number;
    url: string;
    pushedAt: string;
  }>;
  events: Array<{ type: string; repo: string; at: string; detail: string | null }>;
  fetchedAt: string | null;
  error: string | null;
}

export interface ClubGithubRow {
  userId: string;
  name: string;
  login: string;
  publicRepos: number;
  followers: number;
  lastPushAt: string | null;
}

export interface CertificateData {
  code: string;
  issuedAt: string;
  name: string;
  studentId: string;
  generation: number | null;
  joinedAt: string;
  stats: {
    studies: number;
    seminarsAttended: number;
    seminarRate: number;
    missions: number;
    projects: number;
    posts: number;
    points: number;
  };
  highlights: string[];
}

export interface AiSource {
  kind: string;
  title: string;
  href: string | null;
  snippet: string;
}

export interface AiAnswer {
  question: string;
  answer: string;
  sources: AiSource[];
  /** LLM이 붙어 있으면 'claude', 아니면 검색 결과만 돌려준 'search' */
  mode: 'claude' | 'search';
}

export interface MyActivity {
  joinedStudies: Array<{ id: string; title: string; status: StudyStatus; joinedAt: string }>;
  attendance: AttendanceStat;
  submissions: Array<{
    missionId: string;
    title: string;
    submittedAt: string;
    score: number | null;
    feedback: string | null;
  }>;
  projects: Array<{ id: string; name: string; role: string; status: ProjectStatus }>;
  counts: { posts: number; comments: number; questions: number; answers: number; files: number };
  points: number;
  timeline: ActivityItem[];
}

/* ------------------------------------------------------------
   관리자
   ------------------------------------------------------------ */

export interface AdminUserRow {
  id: string;
  studentId: string;
  name: string;
  role: Role;
  generation: number | null;
  createdAt: string;
  lastLoginAt: string | null;
  lockedUntil: string | null;
  whitelisted: boolean;
}

export interface WhitelistRow {
  studentId: string;
  generation: number | null;
  note: string | null;
  addedBy: string;
  addedAt: string;
  joined: boolean; // 그 학번으로 가입한 계정 존재 여부
}

export interface AccessLogRow {
  id: string;
  studentId: string | null;
  userName: string | null;
  action: string; // LOGIN_SUCCESS | LOGIN_FAIL | LOGOUT | LOCKED | MEMBER_DENIED | SIGNUP
  path: string | null;
  ipHash: string;
  createdAt: string;
}

export interface AuditLogRow {
  id: string;
  actorName: string;
  actorStudentId: string;
  action: string; // ROLE_CHANGE | WHITELIST_ADD | WHITELIST_REMOVE | SETTINGS_UPDATE | DB_UNLOCK | DB_UNLOCK_FAIL | EXPORT | USER_LOCK | USER_UNLOCK | FORCE_LOGOUT
  targetType: string | null;
  targetId: string | null;
  reason: string | null;
  ipHash: string;
  createdAt: string;
}

export const RACK_UNITS = 42;
export type RackKind = 'SERVER' | 'SWITCH' | 'UPS' | 'NAS' | 'ETC';
export type RackStatus = 'OK' | 'MAINTENANCE' | 'OFFLINE';

export interface RackDeviceRow {
  id: string;
  name: string;
  kind: RackKind;
  startUnit: number;
  unitSize: number;
  status: RackStatus;
  purpose: string | null;
  ownerId: string | null;
  ownerName: string | null;
  healthUrl: string | null;
  lastSeenAt: string | null;
  note: string | null;
}

export interface AdminDashboard {
  users: number;
  members: number;
  guests: number;
  admins: number;
  totalApplications: number;
  todayApplications: number;
  rackDevices: number;
  recentAccess: AccessLogRow[];
  recentAudit: AuditLogRow[];
}

export interface SiteSettings {
  generation: number;
  startsAt: string;
  endsAt: string;
  googleFormUrl: string;
  stats: {
    members: number;
    servers: number;
    projects: number;
    roomLocation: string;
  };
}
