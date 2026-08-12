import { USER_VALIDATION } from '@sowl/shared';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class SignupDto {
  @IsString()
  @Matches(USER_VALIDATION.namePattern, {
    message: '이름은 2~10자의 한글 또는 영문이어야 합니다.',
  })
  name!: string;

  @IsString()
  @Matches(USER_VALIDATION.studentIdPattern, {
    message: '학번은 숫자 9자리(입학년도 4자리 + 5자리)여야 합니다.',
  })
  studentId!: string;

  // 8자 이상 + 특수문자 — 세부 검증은 서비스에서 checkPassword로 한 번 더
  @IsString()
  @MaxLength(200)
  password!: string;

  @IsOptional()
  @IsEmail({}, { message: '올바른 이메일 주소가 아닙니다.' })
  email?: string;

  @IsBoolean()
  @Equals(true, { message: '약관·개인정보 처리방침에 동의해 주세요.' })
  agreedToTerms!: boolean;
}

export class LoginDto {
  @IsString()
  @MaxLength(20)
  studentId!: string;

  @IsString()
  @MaxLength(200)
  password!: string;
}
