import { VALIDATION } from '@sowl/shared';

/* 지원서 폼 상태 — 백엔드 DTO와 같은 규칙(@sowl/shared VALIDATION)을 쓴다 */
export interface FormState {
  name: string;
  studentId: string;
  department: string;
  grade: string;
  phone: string;
  email: string;
  interests: string[];
  level: string;
  days: string[];
  motivation: string;
  project: string;
  privacy: boolean;
}

export const emptyState = (): FormState => ({
  name: '',
  studentId: '',
  department: '',
  grade: '',
  phone: '',
  email: '',
  interests: [],
  level: '',
  days: [],
  motivation: '',
  project: '',
  privacy: false,
});

type RuleKey =
  | 'name'
  | 'studentId'
  | 'department'
  | 'grade'
  | 'phone'
  | 'email'
  | 'interests'
  | 'level'
  | 'motivation'
  | 'privacy';

export const RULES: Record<RuleKey, (s: FormState) => boolean> = {
  name: (s) => s.name.length >= VALIDATION.nameMin,
  studentId: (s) => VALIDATION.studentIdPattern.test(s.studentId),
  department: (s) => s.department.length >= VALIDATION.departmentMin,
  grade: (s) => s.grade.length > 0,
  phone: (s) => VALIDATION.phonePattern.test(s.phone),
  email: (s) => VALIDATION.emailPattern.test(s.email),
  interests: (s) => s.interests.length >= VALIDATION.interestsMin,
  level: (s) => s.level.length > 0,
  motivation: (s) => s.motivation.length >= VALIDATION.motivationMin,
  privacy: (s) => s.privacy === true,
};

export const REQUIRED_KEYS = Object.keys(RULES) as RuleKey[];
export type { RuleKey };
