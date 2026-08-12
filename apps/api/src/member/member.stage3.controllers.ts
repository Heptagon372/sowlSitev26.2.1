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
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { User } from '@prisma/client';
import type {
  AiAnswer,
  CertificateData,
  ChatMessageRow,
  ChatRoomRow,
  CommunityHub,
  ContestFeedRow,
  ContestRow,
  DuesPage,
  EventRow,
  GithubActivity,
  HackathonRow,
  HackathonStatus,
  KanbanBoard,
  PortfolioItem,
  TaskStatus,
} from '@sowl/shared';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AdminGuard, MemberGuard } from '../common/guards/auth.guards';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AiService } from './ai.service';
import { CertificateService } from './certificate.service';
import { ChatService } from './chat.service';
import { ContestsService } from './contests.service';
import { DuesService } from './dues.service';
import { EventsService } from './events.service';
import { GithubService } from './github.service';
import { HackathonService } from './hackathon.service';
import { KanbanService } from './kanban.service';
import { PortfolioService } from './portfolio.service';

const isAdmin = (u: User) => u.role === 'ADMIN';

/* ---------- DTO ---------- */

class SignupDto {
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}
class EventSignupConfigDto {
  @IsBoolean() signupOpen!: boolean;
  @IsOptional() @IsInt() @Min(1) capacity?: number;
}

class TaskCreateDto {
  @IsString() @MinLength(1) @MaxLength(150) title!: string;
  @IsOptional() @IsString() body?: string;
  @IsOptional() @IsIn(['TODO', 'DOING', 'REVIEW', 'DONE']) status?: TaskStatus;
  @IsOptional() @IsString() assigneeId?: string;
  @IsOptional() @IsString() milestoneId?: string;
  @IsOptional() @IsString() dueAt?: string;
}
class TaskUpdateDto {
  @IsOptional() @IsString() @MaxLength(150) title?: string;
  @IsOptional() @IsString() body?: string;
  @IsOptional() @IsIn(['TODO', 'DOING', 'REVIEW', 'DONE']) status?: TaskStatus;
  @IsOptional() @IsInt() order?: number;
  @IsOptional() @IsString() assigneeId?: string;
  @IsOptional() @IsString() milestoneId?: string;
  @IsOptional() @IsString() dueAt?: string;
}
class MilestoneDto {
  @IsString() @MinLength(1) @MaxLength(100) title!: string;
  @IsOptional() @IsString() dueAt?: string;
}

class HackathonCreateDto {
  @IsInt() @Min(1) round!: number;
  @IsString() @MinLength(2) @MaxLength(100) title!: string;
  @IsOptional() @IsString() @MaxLength(100) theme?: string;
  @IsOptional() @IsString() description?: string;
  @IsString() startsAt!: string;
  @IsString() endsAt!: string;
  @IsOptional() @IsString() @MaxLength(100) location?: string;
  @IsOptional() @IsIn(['PLANNED', 'OPEN', 'ONGOING', 'DONE']) status?: HackathonStatus;
}
class HackathonStatusDto {
  @IsIn(['PLANNED', 'OPEN', 'ONGOING', 'DONE']) status!: HackathonStatus;
}
class TeamCreateDto {
  @IsString() @MinLength(1) @MaxLength(60) name!: string;
  @IsOptional() @IsString() idea?: string;
}
class TeamSubmitDto {
  @IsOptional() @IsString() @MaxLength(300) repoUrl?: string;
  @IsOptional() @IsString() @MaxLength(300) demoUrl?: string;
  @IsOptional() @IsString() idea?: string;
}
class TeamScoreDto {
  @IsInt() @Min(0) score!: number;
  @IsOptional() @IsInt() @Min(1) rank?: number;
}

class PublicDto {
  @IsBoolean() isPublic!: boolean;
}
class ThumbnailDto {
  @IsString() @MaxLength(500) thumbnailUrl!: string;
}

class ChatRoomDto {
  @IsString() @MinLength(1) @MaxLength(30) slug!: string;
  @IsString() @MinLength(1) @MaxLength(40) name!: string;
  @IsOptional() @IsString() @MaxLength(120) description?: string;
}
class ChatPostDto {
  @IsString() @MinLength(1) @MaxLength(2000) body!: string;
}

class DuesTermDto {
  @IsString() @MinLength(1) @MaxLength(40) name!: string;
  @IsInt() @Min(0) amount!: number;
  @IsString() dueDate!: string;
}
class DuesPaidDto {
  @IsString() userId!: string;
  @IsBoolean() paid!: boolean;
  @IsInt() @Min(0) amount!: number;
  @IsOptional() @IsIn(['CASH', 'TRANSFER', 'ETC']) method?: string;
}
class ExpenseDto {
  @IsString() @MinLength(1) @MaxLength(100) title!: string;
  @IsInt() @Min(0) amount!: number;
  @IsOptional() @IsString() @MaxLength(20) category?: string;
  @IsString() spentAt!: string;
  @IsOptional() @IsString() termId?: string;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}

class ContestDto {
  @IsString() @MinLength(2) @MaxLength(200) title!: string;
  @IsString() @MaxLength(500) url!: string;
  @IsOptional() @IsString() @MaxLength(100) host?: string;
  @IsOptional() @IsString() @MaxLength(40) category?: string;
  @IsOptional() @IsString() @MaxLength(100) prize?: string;
  @IsOptional() @IsString() summary?: string;
  @IsOptional() @IsString() deadline?: string;
}
class ContestFeedDto {
  @IsString() @MinLength(1) @MaxLength(60) name!: string;
  @IsString() @MaxLength(500) url!: string;
}

class AskDto {
  @IsString() @MinLength(2) @MaxLength(500) question!: string;
}

class GithubLinkDto {
  @IsString() @MaxLength(50) login!: string;
}

/* ---------- 동아리 행사 ---------- */

@Controller('member/events')
@UseGuards(MemberGuard)
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  list(@CurrentUser() user: User, @Query('scope') scope?: string): Promise<EventRow[]> {
    return this.events.list(user.id, scope === 'all' ? 'all' : 'upcoming');
  }

  @Get(':id/signups')
  signups(@Param('id') id: string) {
    return this.events.signups(id);
  }

  @Post(':id/signup')
  @HttpCode(200)
  async signup(
    @Param('id') id: string,
    @Body() dto: SignupDto,
    @CurrentUser() user: User,
  ): Promise<{ ok: true }> {
    await this.events.signup(id, user.id, dto.note);
    return { ok: true };
  }

  @Delete(':id/signup')
  async cancel(@Param('id') id: string, @CurrentUser() user: User): Promise<{ ok: true }> {
    await this.events.cancel(id, user.id);
    return { ok: true };
  }

  @Patch(':id/config')
  @UseGuards(AdminGuard)
  config(@Param('id') id: string, @Body() dto: EventSignupConfigDto) {
    return this.events.setSignup(id, dto.signupOpen, dto.capacity ?? null);
  }
}

/* ---------- 프로젝트 관리 (칸반) ---------- */

@Controller('member/kanban')
@UseGuards(MemberGuard)
export class KanbanController {
  constructor(private readonly kanban: KanbanService) {}

  @Get(':projectId')
  board(@Param('projectId') projectId: string, @CurrentUser() user: User): Promise<KanbanBoard> {
    return this.kanban.board(projectId, user.id, isAdmin(user));
  }

  @Post(':projectId/tasks')
  createTask(
    @Param('projectId') projectId: string,
    @Body() dto: TaskCreateDto,
    @CurrentUser() user: User,
  ) {
    return this.kanban.createTask(projectId, user.id, isAdmin(user), dto);
  }

  @Patch('tasks/:taskId')
  updateTask(
    @Param('taskId') taskId: string,
    @Body() dto: TaskUpdateDto,
    @CurrentUser() user: User,
  ) {
    return this.kanban.updateTask(taskId, user.id, isAdmin(user), dto);
  }

  @Delete('tasks/:taskId')
  removeTask(@Param('taskId') taskId: string, @CurrentUser() user: User) {
    return this.kanban.removeTask(taskId, user.id, isAdmin(user));
  }

  @Post(':projectId/milestones')
  createMilestone(
    @Param('projectId') projectId: string,
    @Body() dto: MilestoneDto,
    @CurrentUser() user: User,
  ) {
    return this.kanban.createMilestone(projectId, user.id, isAdmin(user), dto);
  }

  @Patch('milestones/:id/toggle')
  toggleMilestone(@Param('id') id: string, @CurrentUser() user: User) {
    return this.kanban.toggleMilestone(id, user.id, isAdmin(user));
  }

  @Delete('milestones/:id')
  removeMilestone(@Param('id') id: string, @CurrentUser() user: User) {
    return this.kanban.removeMilestone(id, user.id, isAdmin(user));
  }
}

/* ---------- 해커톤 ---------- */

@Controller('member/hackathons')
@UseGuards(MemberGuard)
export class HackathonController {
  constructor(private readonly hackathon: HackathonService) {}

  @Get()
  list(@CurrentUser() user: User): Promise<HackathonRow[]> {
    return this.hackathon.list(user.id);
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: HackathonCreateDto) {
    return this.hackathon.create(dto);
  }

  @Patch(':id/status')
  @UseGuards(AdminGuard)
  setStatus(@Param('id') id: string, @Body() dto: HackathonStatusDto) {
    return this.hackathon.setStatus(id, dto.status);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id') id: string) {
    return this.hackathon.remove(id);
  }

  @Post(':id/teams')
  createTeam(@Param('id') id: string, @Body() dto: TeamCreateDto, @CurrentUser() user: User) {
    return this.hackathon.createTeam(id, user.id, dto.name, dto.idea);
  }

  @Post('teams/:teamId/join')
  @HttpCode(200)
  async joinTeam(@Param('teamId') teamId: string, @CurrentUser() user: User): Promise<{ ok: true }> {
    await this.hackathon.joinTeam(teamId, user.id);
    return { ok: true };
  }

  @Delete('teams/:teamId/join')
  async leaveTeam(@Param('teamId') teamId: string, @CurrentUser() user: User): Promise<{ ok: true }> {
    await this.hackathon.leaveTeam(teamId, user.id);
    return { ok: true };
  }

  @Patch('teams/:teamId/submit')
  submit(
    @Param('teamId') teamId: string,
    @Body() dto: TeamSubmitDto,
    @CurrentUser() user: User,
  ) {
    return this.hackathon.submit(teamId, user.id, isAdmin(user), dto);
  }

  @Patch('teams/:teamId/score')
  @UseGuards(AdminGuard)
  score(@Param('teamId') teamId: string, @Body() dto: TeamScoreDto) {
    return this.hackathon.score(teamId, dto.score, dto.rank);
  }
}

/* ---------- 포트폴리오 · 커뮤니티 허브 ---------- */

@Controller('member/portfolio')
@UseGuards(MemberGuard)
export class PortfolioController {
  constructor(private readonly portfolio: PortfolioService) {}

  @Get()
  gallery(@CurrentUser() user: User, @Query('public') onlyPublic?: string): Promise<PortfolioItem[]> {
    return this.portfolio.gallery(user.id, isAdmin(user), onlyPublic === 'true');
  }

  @Patch(':projectId/public')
  setPublic(
    @Param('projectId') projectId: string,
    @Body() dto: PublicDto,
    @CurrentUser() user: User,
  ) {
    return this.portfolio.setPublic(projectId, user.id, isAdmin(user), dto.isPublic);
  }

  @Patch(':projectId/thumbnail')
  @UseGuards(AdminGuard)
  setThumbnail(@Param('projectId') projectId: string, @Body() dto: ThumbnailDto) {
    return this.portfolio.setThumbnail(projectId, dto.thumbnailUrl);
  }
}

@Controller('member/community')
@UseGuards(MemberGuard)
export class CommunityController {
  constructor(private readonly portfolio: PortfolioService) {}

  @Get()
  hub(@CurrentUser() user: User): Promise<CommunityHub> {
    return this.portfolio.hub(user.id);
  }
}

/* ---------- 채팅 (REST 보조 — 실시간은 ChatGateway) ---------- */

@Controller('member/chat')
@UseGuards(MemberGuard)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('rooms')
  rooms(): Promise<ChatRoomRow[]> {
    return this.chat.rooms();
  }

  @Get('rooms/:slug/messages')
  history(
    @Param('slug') slug: string,
    @Query('take', new ParseIntPipe({ optional: true })) take?: number,
  ): Promise<ChatMessageRow[]> {
    return this.chat.history(slug, take ?? 60);
  }

  /** WebSocket이 막힌 환경을 위한 폴백 전송 경로 */
  @Post('rooms/:slug/messages')
  @HttpCode(200)
  post(
    @Param('slug') slug: string,
    @Body() dto: ChatPostDto,
    @CurrentUser() user: User,
  ): Promise<ChatMessageRow | null> {
    return this.chat.post(slug, user.id, dto.body);
  }

  @Post('rooms')
  @UseGuards(AdminGuard)
  createRoom(@Body() dto: ChatRoomDto) {
    return this.chat.createRoom(dto);
  }

  @Delete('rooms/:id')
  @UseGuards(AdminGuard)
  removeRoom(@Param('id') id: string) {
    return this.chat.removeRoom(id);
  }
}

/* ---------- 회비 / 운영비 ---------- */

@Controller('member/dues')
@UseGuards(MemberGuard)
export class DuesController {
  constructor(private readonly dues: DuesService) {}

  @Get()
  page(@CurrentUser() user: User): Promise<DuesPage> {
    return this.dues.page(user.id, isAdmin(user));
  }

  @Post('terms')
  @UseGuards(AdminGuard)
  async createTerm(@Body() dto: DuesTermDto) {
    const term = await this.dues.createTerm(dto);
    await this.dues.openTermForMembers(term.id);
    return term;
  }

  @Delete('terms/:id')
  @UseGuards(AdminGuard)
  removeTerm(@Param('id') id: string) {
    return this.dues.removeTerm(id);
  }

  @Patch('terms/:termId/paid')
  @UseGuards(AdminGuard)
  setPaid(@Param('termId') termId: string, @Body() dto: DuesPaidDto) {
    return this.dues.setPaid(termId, dto.userId, dto.paid, dto.amount, dto.method);
  }

  @Post('expenses')
  @UseGuards(AdminGuard)
  addExpense(@Body() dto: ExpenseDto, @CurrentUser() user: User) {
    return this.dues.addExpense(user.id, dto);
  }

  @Delete('expenses/:id')
  @UseGuards(AdminGuard)
  removeExpense(@Param('id') id: string) {
    return this.dues.removeExpense(id);
  }
}

/* ---------- 수료 / 활동 인증 ---------- */

@Controller('member/certificate')
@UseGuards(MemberGuard)
export class CertificateController {
  constructor(private readonly certificate: CertificateService) {}

  @Get()
  preview(@CurrentUser() user: User): Promise<CertificateData> {
    return this.certificate.preview(user.id);
  }

  @Get('mine')
  mine(@CurrentUser() user: User) {
    return this.certificate.mine(user.id);
  }

  @Get('verify/:code')
  verify(@Param('code') code: string): Promise<CertificateData> {
    return this.certificate.verify(code);
  }

  @Post('issue')
  @HttpCode(200)
  issue(@CurrentUser() user: User): Promise<CertificateData> {
    return this.certificate.issue(user.id);
  }
}

/* ---------- GitHub 연동 ---------- */

@Controller('member/github')
@UseGuards(MemberGuard)
export class GithubController {
  constructor(private readonly github: GithubService) {}

  @Get()
  mine(@CurrentUser() user: User, @Query('refresh') refresh?: string): Promise<GithubActivity> {
    return this.github.activity(user.githubLogin, refresh === 'true');
  }

  @Get('club')
  club() {
    return this.github.club();
  }

  @Get('user/:login')
  other(@Param('login') login: string): Promise<GithubActivity> {
    return this.github.activity(login);
  }
}

/* ---------- 공모전 ---------- */

@Controller('member/contests')
@UseGuards(MemberGuard)
export class ContestsController {
  constructor(private readonly contests: ContestsService) {}

  @Get()
  list(
    @CurrentUser() user: User,
    @Query('q') q?: string,
    @Query('open') open?: string,
    @Query('bookmarked') bookmarked?: string,
  ): Promise<ContestRow[]> {
    return this.contests.list(user.id, {
      q,
      onlyOpen: open === 'true',
      onlyBookmarked: bookmarked === 'true',
    });
  }

  @Post(':id/bookmark')
  @HttpCode(200)
  bookmark(@Param('id') id: string, @CurrentUser() user: User) {
    return this.contests.toggleBookmark(id, user.id);
  }

  @Post()
  @UseGuards(AdminGuard)
  add(@Body() dto: ContestDto) {
    return this.contests.add(dto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id') id: string) {
    return this.contests.remove(id);
  }

  @Get('feeds/list')
  @UseGuards(AdminGuard)
  feeds(): Promise<ContestFeedRow[]> {
    return this.contests.feeds();
  }

  @Post('feeds')
  @UseGuards(AdminGuard)
  addFeed(@Body() dto: ContestFeedDto) {
    return this.contests.addFeed(dto.name, dto.url);
  }

  @Delete('feeds/:id')
  @UseGuards(AdminGuard)
  removeFeed(@Param('id') id: string) {
    return this.contests.removeFeed(id);
  }

  @Post('refresh')
  @HttpCode(200)
  @UseGuards(AdminGuard)
  refresh() {
    return this.contests.refresh();
  }
}

/* ---------- S.OWL AI ---------- */

@Controller('member/ai')
@UseGuards(MemberGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('status')
  status(): { enabled: boolean } {
    return { enabled: this.ai.enabled };
  }

  // 외부 API 호출이 붙으므로 사용자당 분당 호출을 제한한다
  @Post('ask')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  ask(@Body() dto: AskDto, @CurrentUser() user: User): Promise<AiAnswer> {
    return this.ai.ask(dto.question, user.id);
  }
}

/* ---------- 프로필의 GitHub 계정 연결 (편의 엔드포인트) ---------- */

@Controller('member/github-link')
@UseGuards(MemberGuard)
export class GithubLinkController {
  constructor(private readonly github: GithubService) {}

  @Post()
  @HttpCode(200)
  async link(@Body() dto: GithubLinkDto, @CurrentUser() user: User): Promise<GithubActivity> {
    // 프로필의 githubLogin 은 /member/profile 에서 저장하고, 여기서는 조회만 미리 해 둔다
    return this.github.activity(dto.login.trim() || null, true);
  }
}
