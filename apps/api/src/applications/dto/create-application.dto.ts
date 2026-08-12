import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  Equals,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  DAY_OPTIONS,
  EXPERIENCE_LEVELS,
  VALIDATION,
  type ExperienceLevel,
} from '@sowl/shared';

export class ApplicantDto {
  @IsString()
  @MinLength(VALIDATION.nameMin, { message: '이름은 2자 이상이어야 합니다.' })
  @MaxLength(50)
  name!: string;

  @Matches(VALIDATION.studentIdPattern, { message: '학번은 6~10자리 숫자여야 합니다.' })
  studentId!: string;

  @IsString()
  @MinLength(VALIDATION.departmentMin, { message: '학과는 2자 이상이어야 합니다.' })
  @MaxLength(60)
  department!: string;

  @IsString()
  @MinLength(1, { message: '학년을 선택해 주세요.' })
  @MaxLength(30)
  grade!: string;

  @Matches(VALIDATION.phonePattern, { message: '연락처는 01X-XXXX-XXXX 형식이어야 합니다.' })
  phone!: string;

  @Matches(VALIDATION.emailPattern, { message: '올바른 이메일 주소가 아닙니다.' })
  @MaxLength(120)
  email!: string;
}

export class CreateApplicationDto {
  @ValidateNested()
  @Type(() => ApplicantDto)
  applicant!: ApplicantDto;

  @IsArray()
  @ArrayMinSize(VALIDATION.interestsMin, { message: '관심 분야를 1개 이상 선택해 주세요.' })
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  interests!: string[];

  @IsIn(EXPERIENCE_LEVELS as readonly string[], { message: '개발 경험 수준을 선택해 주세요.' })
  experience!: ExperienceLevel;

  @IsOptional()
  @IsArray()
  @IsIn(DAY_OPTIONS as readonly string[], { each: true })
  availableDays: string[] = [];

  @IsString()
  @MinLength(VALIDATION.motivationMin, { message: '지원 동기를 30자 이상 작성해 주세요.' })
  @MaxLength(4000)
  motivation!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  wantToBuild?: string | null;

  @Equals(true, { message: '개인정보 수집·이용에 동의해 주세요.' })
  agreedToPrivacyPolicy!: true;
}
