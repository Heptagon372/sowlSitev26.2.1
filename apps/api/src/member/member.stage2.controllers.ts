import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import type {
  ActivityItem,
  AttendanceStat,
  MissionDetail,
  MissionRow,
  MyActivity,
  PointsPage,
  PollRow,
  ProjectRow,
  ProjectStatus,
  QuestionDetail,
  QuestionRow,
  SeminarRow,
  StudyDetail,
  StudyRow,
  StudyStatus,
  TeamPostRow,
} from '@sowl/shared';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AdminGuard, MemberGuard } from '../common/guards/auth.guards';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ActivityService } from './activity.service';
import { MissionsService } from './missions.service';
import { PointsService } from './points.service';
import { PollsService } from './polls.service';
import { ProjectsService } from './projects.service';
import { QnaService } from './qna.service';
import { SeminarsService } from './seminars.service';
import { StudiesService } from './studies.service';

const isAdmin = (u: User) => u.role === 'ADMIN';

/* ---------- DTO ---------- */

class StudyCreateDto {
  @IsString() @MinLength(2) @MaxLength(80) title!: string;
  @IsString() @MinLength(1) description!: string;
  @IsOptional() @IsString() @MaxLength(40) topic?: string;
  @IsOptional() @IsString() @MaxLength(60) schedule?: string;
  @IsOptional() @IsInt() @Min(2) @Max(50) maxMembers?: number;
  @IsOptional() @IsInt() @Min(1) generation?: number;
}
class StudyStatusDto {
  @IsIn(['RECRUITING', 'ONGOING', 'DONE']) status!: StudyStatus;
}
class StudyWeekDto {
  @IsString() @MinLength(1) @MaxLength(100) title!: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() meetAt?: string;
}

class SeminarCreateDto {
  @IsString() @MinLength(2) @MaxLength(100) title!: string;
  @IsOptional() @IsString() description?: string;
  @IsString() startsAt!: string;
  @IsOptional() @IsString() @MaxLength(80) location?: string;
  @IsOptional() @IsString() @MaxLength(300) slideUrl?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) points?: number;
}
class SlideDto {
  @IsString() @MaxLength(300) slideUrl!: string;
}
class CheckInDto {
  @IsString() @MinLength(4) @MaxLength(10) code!: string;
}

class MissionCreateDto {
  @IsString() @MinLength(2) @MaxLength(100) title!: string;
  @IsString() @MinLength(1) body!: string;
  @IsString() dueAt!: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) points?: number;
}
class SubmitDto {
  @IsString() @MinLength(1) content!: string;
  @IsOptional() @IsString() @MaxLength(300) link?: string;
}
class ReviewDto {
  @IsInt() @Min(0) @Max(100) score!: number;
  @IsOptional() @IsString() @MaxLength(1000) feedback?: string;
}

class ProjectCreateDto {
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @IsString() @MinLength(2) @MaxLength(200) summary!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsIn(['PLANNING', 'ONGOING', 'DONE', 'ARCHIVED']) status?: ProjectStatus;
  @IsOptional() @IsArray() @IsString({ each: true }) techStack?: string[];
  @IsOptional() @IsString() @MaxLength(300) repoUrl?: string;
  @IsOptional() @IsString() @MaxLength(300) demoUrl?: string;
  @IsOptional() @IsInt() @Min(1) generation?: number;
}
class ProjectUpdateDto {
  @IsOptional() @IsString() @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(200) summary?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsIn(['PLANNING', 'ONGOING', 'DONE', 'ARCHIVED']) status?: ProjectStatus;
  @IsOptional() @IsArray() @IsString({ each: true }) techStack?: string[];
  @IsOptional() @IsString() @MaxLength(300) repoUrl?: string;
  @IsOptional() @IsString() @MaxLength(300) demoUrl?: string;
}

class TeamPostDto {
  @IsString() @MinLength(2) @MaxLength(100) title!: string;
  @IsString() @MinLength(1) body!: string;
  @IsOptional() @IsArray() @IsString({ each: true }) positions?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) techStack?: string[];
  @IsOptional() @IsString() projectId?: string;
}
class TeamApplyDto {
  @IsString() @MinLength(1) @MaxLength(1000) message!: string;
  @IsOptional() @IsString() @MaxLength(40) position?: string;
}
class DecideDto {
  @IsBoolean() accept!: boolean;
}

class QuestionDto {
  @IsString() @MinLength(2) @MaxLength(120) title!: string;
  @IsString() @MinLength(1) body!: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}
class AnswerDto {
  @IsString() @MinLength(1) body!: string;
}

class PollCreateDto {
  @IsString() @MinLength(2) @MaxLength(120) title!: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
  @IsArray() @IsString({ each: true }) options!: string[];
  @IsOptional() @IsBoolean() multiple?: boolean;
  @IsOptional() @IsBoolean() anonymous?: boolean;
  @IsOptional() @IsString() closesAt?: string;
}

/* ---------- 스터디 ---------- */

@Controller('member/studies')
@UseGuards(MemberGuard)
export class StudiesController {
  constructor(private readonly studies: StudiesService) {}

  @Get()
  list(
    @CurrentUser() user: User,
    @Query('status') status?: StudyStatus,
    @Query('q') q?: string,
  ): Promise<StudyRow[]> {
    return this.studies.list(user.id, status || undefined, q || undefined);
  }

  @Get(':id')
  detail(@Param('id') id: string, @CurrentUser() user: User): Promise<StudyDetail> {
    return this.studies.detail(id, user.id);
  }

  @Post()
  create(@Body() dto: StudyCreateDto, @CurrentUser() user: User) {
    return this.studies.create(user.id, dto);
  }

  @Post(':id/join')
  @HttpCode(200)
  async join(@Param('id') id: string, @CurrentUser() user: User): Promise<{ ok: true }> {
    await this.studies.join(id, user.id);
    return { ok: true };
  }

  @Delete(':id/join')
  async leave(@Param('id') id: string, @CurrentUser() user: User): Promise<{ ok: true }> {
    await this.studies.leave(id, user.id);
    return { ok: true };
  }

  @Patch(':id/status')
  setStatus(@Param('id') id: string, @Body() dto: StudyStatusDto, @CurrentUser() user: User) {
    return this.studies.setStatus(id, dto.status, user.id, isAdmin(user));
  }

  @Post(':id/weeks')
  addWeek(@Param('id') id: string, @Body() dto: StudyWeekDto, @CurrentUser() user: User) {
    return this.studies.addWeek(id, user.id, isAdmin(user), dto);
  }

  @Patch('weeks/:weekId/toggle')
  toggleWeek(@Param('weekId') weekId: string, @CurrentUser() user: User) {
    return this.studies.toggleWeek(weekId, user.id, isAdmin(user));
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.studies.remove(id, user.id, isAdmin(user));
  }
}

/* ---------- 세미나 · 출석 ---------- */

@Controller('member/seminars')
@UseGuards(MemberGuard)
export class SeminarsController {
  constructor(private readonly seminars: SeminarsService) {}

  @Get()
  list(@CurrentUser() user: User): Promise<SeminarRow[]> {
    return this.seminars.list(user.id, isAdmin(user));
  }

  @Get('attendance/me')
  myStats(@CurrentUser() user: User): Promise<AttendanceStat> {
    return this.seminars.myStats(user.id);
  }

  @Get(':id/attendees')
  attendees(@Param('id') id: string) {
    return this.seminars.attendees(id);
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: SeminarCreateDto) {
    return this.seminars.create(dto);
  }

  @Post(':id/speaker')
  @HttpCode(200)
  claim(@Param('id') id: string, @CurrentUser() user: User) {
    return this.seminars.claimSpeaker(id, user.id);
  }

  @Patch(':id/slide')
  slide(@Param('id') id: string, @Body() dto: SlideDto, @CurrentUser() user: User) {
    return this.seminars.setSlide(id, user.id, isAdmin(user), dto.slideUrl);
  }

  @Post(':id/code')
  @HttpCode(200)
  openCode(@Param('id') id: string, @CurrentUser() user: User) {
    return this.seminars.openCode(id, user.id, isAdmin(user));
  }

  @Delete(':id/code')
  async closeCode(@Param('id') id: string, @CurrentUser() user: User): Promise<{ ok: true }> {
    await this.seminars.closeCode(id, user.id, isAdmin(user));
    return { ok: true };
  }

  @Post('check-in')
  @HttpCode(200)
  checkIn(@Body() dto: CheckInDto, @CurrentUser() user: User) {
    return this.seminars.checkIn(dto.code, user.id);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id') id: string) {
    return this.seminars.remove(id);
  }
}

/* ---------- 과제 / 미션 ---------- */

@Controller('member/missions')
@UseGuards(MemberGuard)
export class MissionsController {
  constructor(private readonly missions: MissionsService) {}

  @Get()
  list(@CurrentUser() user: User): Promise<MissionRow[]> {
    return this.missions.list(user.id);
  }

  @Get(':id')
  detail(@Param('id') id: string, @CurrentUser() user: User): Promise<MissionDetail> {
    return this.missions.detail(id, user.id, isAdmin(user));
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: MissionCreateDto, @CurrentUser() user: User) {
    return this.missions.create(user.id, dto);
  }

  @Post(':id/submit')
  @HttpCode(200)
  submit(@Param('id') id: string, @Body() dto: SubmitDto, @CurrentUser() user: User) {
    return this.missions.submit(id, user.id, dto.content, dto.link);
  }

  @Post('submissions/:submissionId/review')
  @HttpCode(200)
  @UseGuards(AdminGuard)
  async review(
    @Param('submissionId') submissionId: string,
    @Body() dto: ReviewDto,
    @CurrentUser() user: User,
  ): Promise<{ ok: true }> {
    await this.missions.review(submissionId, user.id, dto.score, dto.feedback);
    return { ok: true };
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id') id: string) {
    return this.missions.remove(id);
  }
}

/* ---------- 프로젝트 · 팀원 모집 ---------- */

@Controller('member/projects')
@UseGuards(MemberGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(@Query('status') status?: ProjectStatus, @Query('q') q?: string): Promise<ProjectRow[]> {
    return this.projects.list(status || undefined, q || undefined);
  }

  @Post()
  create(@Body() dto: ProjectCreateDto, @CurrentUser() user: User) {
    return this.projects.create(user.id, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: ProjectUpdateDto, @CurrentUser() user: User) {
    return this.projects.update(id, user.id, isAdmin(user), dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.projects.remove(id, user.id, isAdmin(user));
  }
}

@Controller('member/team-posts')
@UseGuards(MemberGuard)
export class TeamPostsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(
    @CurrentUser() user: User,
    @Query('status') status?: string,
    @Query('position') position?: string,
    @Query('tech') tech?: string,
  ): Promise<TeamPostRow[]> {
    return this.projects.teamPosts(user.id, {
      status: status || undefined,
      position: position || undefined,
      tech: tech || undefined,
    });
  }

  @Post()
  create(@Body() dto: TeamPostDto, @CurrentUser() user: User) {
    return this.projects.createTeamPost(user.id, dto);
  }

  @Post(':id/apply')
  @HttpCode(200)
  apply(@Param('id') id: string, @Body() dto: TeamApplyDto, @CurrentUser() user: User) {
    return this.projects.apply(id, user.id, dto.message, dto.position);
  }

  @Patch('applications/:applicationId')
  async decide(
    @Param('applicationId') applicationId: string,
    @Body() dto: DecideDto,
    @CurrentUser() user: User,
  ): Promise<{ ok: true }> {
    await this.projects.decideApplication(applicationId, user.id, isAdmin(user), dto.accept);
    return { ok: true };
  }

  @Patch(':id/toggle')
  toggle(@Param('id') id: string, @CurrentUser() user: User) {
    return this.projects.closeTeamPost(id, user.id, isAdmin(user));
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.projects.removeTeamPost(id, user.id, isAdmin(user));
  }
}

/* ---------- 질문 / Q&A ---------- */

@Controller('member/questions')
@UseGuards(MemberGuard)
export class QnaController {
  constructor(private readonly qna: QnaService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('tag') tag?: string,
    @Query('unsolved') unsolved?: string,
  ): Promise<QuestionRow[]> {
    return this.qna.list({ q, tag, unsolved: unsolved === 'true' });
  }

  @Get(':id')
  detail(@Param('id') id: string): Promise<QuestionDetail> {
    return this.qna.detail(id);
  }

  @Post()
  ask(@Body() dto: QuestionDto, @CurrentUser() user: User) {
    return this.qna.ask(user.id, dto);
  }

  @Post(':id/answers')
  answer(@Param('id') id: string, @Body() dto: AnswerDto, @CurrentUser() user: User) {
    return this.qna.answer(id, user.id, dto.body);
  }

  @Post(':id/accept/:answerId')
  @HttpCode(200)
  async accept(
    @Param('id') id: string,
    @Param('answerId') answerId: string,
    @CurrentUser() user: User,
  ): Promise<{ ok: true }> {
    await this.qna.accept(id, answerId, user.id);
    return { ok: true };
  }

  @Delete('answers/:answerId')
  removeAnswer(@Param('answerId') answerId: string, @CurrentUser() user: User) {
    return this.qna.removeAnswer(answerId, user.id, isAdmin(user));
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.qna.removeQuestion(id, user.id, isAdmin(user));
  }
}

/* ---------- 설문 / 투표 ---------- */

@Controller('member/polls')
@UseGuards(MemberGuard)
export class PollsController {
  constructor(private readonly polls: PollsService) {}

  @Get()
  list(@CurrentUser() user: User): Promise<PollRow[]> {
    return this.polls.list(user.id);
  }

  @Post()
  create(@Body() dto: PollCreateDto, @CurrentUser() user: User) {
    return this.polls.create(user.id, dto);
  }

  @Post(':id/vote/:optionId')
  @HttpCode(200)
  async vote(
    @Param('id') id: string,
    @Param('optionId') optionId: string,
    @CurrentUser() user: User,
  ): Promise<{ ok: true }> {
    await this.polls.vote(id, optionId, user.id);
    return { ok: true };
  }

  @Get(':id/voters')
  voters(@Param('id') id: string, @CurrentUser() user: User) {
    return this.polls.voters(id, user.id, isAdmin(user));
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.polls.remove(id, user.id, isAdmin(user));
  }
}

/* ---------- 포인트 · 활동 기록 ---------- */

@Controller('member/points')
@UseGuards(MemberGuard)
export class PointsController {
  constructor(private readonly points: PointsService) {}

  @Get()
  page(
    @CurrentUser() user: User,
    @Query('generation', new ParseIntPipe({ optional: true })) generation?: number,
  ): Promise<PointsPage> {
    return this.points.page(user.id, generation);
  }
}

@Controller('member/activity')
@UseGuards(MemberGuard)
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  timeline(
    @Query('take', new ParseIntPipe({ optional: true })) take?: number,
    @Query('kinds') kinds?: string,
  ): Promise<ActivityItem[]> {
    return this.activity.timeline(take ?? 60, kinds ? kinds.split(',').filter(Boolean) : undefined);
  }

  @Get('me')
  mine(@CurrentUser() user: User): Promise<MyActivity> {
    return this.activity.mine(user.id);
  }
}
