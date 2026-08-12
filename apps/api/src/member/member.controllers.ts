import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { User } from '@prisma/client';
import type {
  EventRow,
  FileRow,
  MemberDashboard,
  MemberRow,
  NoticeDetail,
  NoticeRow,
  PostDetail,
  PostRow,
  SessionUser,
} from '@sowl/shared';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { Response } from 'express';
import { AdminGuard, MemberGuard } from '../common/guards/auth.guards';
import { CurrentUser, toSessionUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CalendarService } from './calendar.service';
import { FilesService, MAX_FILE_SIZE } from './files.service';
import { NoticesService } from './notices.service';
import { PostsService } from './posts.service';
import { ProfileService } from './profile.service';

/* ---------- DTO ---------- */

class NoticeDto {
  @IsString() @MinLength(1) @MaxLength(150) title!: string;
  @IsString() @MinLength(1) body!: string;
  @IsOptional() @IsBoolean() pinned?: boolean;
}

class EventDto {
  @IsString() @MinLength(1) @MaxLength(150) title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() @MaxLength(100) location?: string;
  @IsString() startsAt!: string;
  @IsOptional() @IsString() endsAt?: string;
  @IsOptional() @IsBoolean() allDay?: boolean;
  @IsOptional() @IsIn(['SEMINAR', 'STUDY', 'HACKATHON', 'MEETING', 'ETC']) kind?: string;
}

class PostCreateDto {
  @IsString() @MinLength(1) @MaxLength(150) title!: string;
  @IsString() @MinLength(1) body!: string;
}

class CommentDto {
  @IsString() @MinLength(1) @MaxLength(2000) body!: string;
}

class ProfileDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() @MaxLength(100) email?: string;
  @IsOptional() @IsString() @MaxLength(50) department?: string;
  @IsOptional() @IsString() @MaxLength(500) bio?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) techStack?: string[];
  @IsOptional() @IsString() @MaxLength(50) githubLogin?: string;
}

class PasswordDto {
  @IsString() current!: string;
  @IsString() @MaxLength(200) next!: string;
}

/* ---------- 홈 (대시보드) ---------- */

@Controller('member/dashboard')
@UseGuards(MemberGuard)
export class DashboardController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notices: NoticesService,
    private readonly calendar: CalendarService,
    private readonly posts: PostsService,
  ) {}

  @Get()
  async summary(@CurrentUser() user: User): Promise<MemberDashboard> {
    const [memberCount, notices, events, posts] = await Promise.all([
      this.prisma.user.count({ where: { role: { in: ['MEMBER', 'ADMIN'] } } }),
      this.notices.list(user.id, 5),
      this.calendar.upcoming(5),
      this.posts.list(user.id, 1, 5),
    ]);
    return { memberCount, notices, events, posts: posts.items };
  }
}

/* ---------- 공지 ---------- */

@Controller('member/notices')
export class NoticesController {
  constructor(private readonly notices: NoticesService) {}

  @Get()
  @UseGuards(MemberGuard)
  list(@CurrentUser() user: User): Promise<NoticeRow[]> {
    return this.notices.list(user.id);
  }

  @Get(':id')
  @UseGuards(MemberGuard)
  detail(@Param('id') id: string, @CurrentUser() user: User): Promise<NoticeDetail> {
    return this.notices.detail(id, user.id);
  }

  // 공지 작성·수정·삭제는 관리자만
  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: NoticeDto, @CurrentUser() user: User) {
    return this.notices.create(user.id, dto);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(@Param('id') id: string, @Body() dto: NoticeDto) {
    return this.notices.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id') id: string) {
    return this.notices.remove(id);
  }
}

/* ---------- 일정 ---------- */

@Controller('member/calendar')
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get()
  @UseGuards(MemberGuard)
  month(@Query('month') month?: string): Promise<EventRow[]> {
    return this.calendar.month(month ?? '');
  }

  @Get('ical')
  @UseGuards(MemberGuard)
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="sowl-calendar.ics"')
  ical(): Promise<string> {
    return this.calendar.ical();
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: EventDto, @CurrentUser() user: User) {
    return this.calendar.create({ ...dto, createdBy: user.id });
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id') id: string) {
    return this.calendar.remove(id);
  }
}

/* ---------- 회원 목록 ---------- */

@Controller('member/members')
@UseGuards(MemberGuard)
export class MembersController {
  constructor(private readonly prisma: PrismaService) {}

  /** 부원 목록 — 연락처(이메일·학번 뒷자리 등)는 내려주지 않는다 */
  @Get()
  async list(
    @Query('q') q?: string,
    @Query('generation', new ParseIntPipe({ optional: true })) generation?: number,
    @Query('department') department?: string,
  ): Promise<MemberRow[]> {
    const users = await this.prisma.user.findMany({
      where: {
        role: { in: ['MEMBER', 'ADMIN'] },
        ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
        ...(generation ? { generation } : {}),
        ...(department ? { department: { contains: department, mode: 'insensitive' } } : {}),
      },
      orderBy: [{ generation: 'desc' }, { name: 'asc' }],
      take: 300,
    });
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      generation: u.generation,
      department: u.department,
      techStack: u.techStack,
      githubLogin: u.githubLogin,
      bio: u.bio,
      points: u.points,
    }));
  }
}

/* ---------- 내 프로필 ---------- */

@Controller('member/profile')
@UseGuards(MemberGuard)
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Patch()
  async update(@Body() dto: ProfileDto, @CurrentUser() user: User): Promise<SessionUser> {
    return toSessionUser(await this.profile.update(user.id, dto));
  }

  @Post('password')
  @HttpCode(200)
  async password(@Body() dto: PasswordDto, @CurrentUser() user: User): Promise<{ ok: true }> {
    await this.profile.changePassword(user, dto.current, dto.next);
    return { ok: true };
  }
}

/* ---------- 자유게시판 ---------- */

@Controller('member/posts')
@UseGuards(MemberGuard)
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Get()
  list(
    @CurrentUser() user: User,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
  ): Promise<{ total: number; items: PostRow[] }> {
    return this.posts.list(user.id, page ?? 1);
  }

  @Get(':id')
  detail(@Param('id') id: string, @CurrentUser() user: User): Promise<PostDetail> {
    return this.posts.detail(id, user.id);
  }

  @Post()
  create(@Body() dto: PostCreateDto, @CurrentUser() user: User) {
    return this.posts.create(user.id, dto.title, dto.body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.posts.remove(id, user.id, user.role === 'ADMIN');
  }

  @Post(':id/like')
  @HttpCode(200)
  like(@Param('id') id: string, @CurrentUser() user: User) {
    return this.posts.toggleLike(id, user.id);
  }

  @Post(':id/comments')
  comment(@Param('id') id: string, @Body() dto: CommentDto, @CurrentUser() user: User) {
    return this.posts.addComment(id, user.id, dto.body);
  }

  @Delete('comments/:id')
  removeComment(@Param('id') id: string, @CurrentUser() user: User) {
    return this.posts.removeComment(id, user.id, user.role === 'ADMIN');
  }
}

/* ---------- 자료실 ---------- */

@Controller('member/files')
@UseGuards(MemberGuard)
export class FilesController {
  constructor(private readonly files: FilesService) {}

  /** studyId 를 주면 스터디 자료실, 없으면 공용 자료실 */
  @Get()
  list(
    @Query('category') category?: string,
    @Query('q') q?: string,
    @Query('studyId') studyId?: string,
  ): Promise<FileRow[]> {
    return this.files.list(category, q, studyId || undefined);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE } }))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('category') category: string,
    @Body('studyId') studyId: string | undefined,
    @CurrentUser() user: User,
  ): Promise<FileRow> {
    return this.files.save(user.id, category ?? '기타', file, studyId || undefined);
  }

  @Get(':id/download')
  async download(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const f = await this.files.forDownload(id);
    res.download(f.path, f.name);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.files.remove(id, user.id, user.role === 'ADMIN');
  }
}
