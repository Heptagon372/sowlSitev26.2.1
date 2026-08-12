import { Module } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { AiService } from './ai.service';
import { CalendarService } from './calendar.service';
import { CertificateService } from './certificate.service';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ContestsService } from './contests.service';
import { DuesService } from './dues.service';
import { EventsService } from './events.service';
import { FilesService } from './files.service';
import { GithubService } from './github.service';
import { HackathonService } from './hackathon.service';
import { KanbanService } from './kanban.service';
import {
  CalendarController,
  DashboardController,
  FilesController,
  MembersController,
  NoticesController,
  PostsController,
  ProfileController,
} from './member.controllers';
import {
  ActivityController,
  MissionsController,
  PointsController,
  PollsController,
  ProjectsController,
  QnaController,
  SeminarsController,
  StudiesController,
  TeamPostsController,
} from './member.stage2.controllers';
import {
  AiController,
  CertificateController,
  ChatController,
  CommunityController,
  ContestsController,
  DuesController,
  EventsController,
  GithubController,
  GithubLinkController,
  HackathonController,
  KanbanController,
  PortfolioController,
} from './member.stage3.controllers';
import { MissionsService } from './missions.service';
import { NoticesService } from './notices.service';
import { PointsService } from './points.service';
import { PollsService } from './polls.service';
import { PortfolioService } from './portfolio.service';
import { PostsService } from './posts.service';
import { ProfileService } from './profile.service';
import { ProjectsService } from './projects.service';
import { QnaService } from './qna.service';
import { SeminarsService } from './seminars.service';
import { StudiesService } from './studies.service';

/** 회원 전용 공간 (/api/member/**) — 전부 MemberGuard, 쓰기 일부는 AdminGuard */
@Module({
  controllers: [
    // 1차
    DashboardController,
    NoticesController,
    CalendarController,
    MembersController,
    ProfileController,
    PostsController,
    FilesController,
    // 2차
    StudiesController,
    SeminarsController,
    MissionsController,
    ProjectsController,
    TeamPostsController,
    QnaController,
    PollsController,
    PointsController,
    ActivityController,
    // 3차
    EventsController,
    KanbanController,
    HackathonController,
    PortfolioController,
    CommunityController,
    ChatController,
    DuesController,
    CertificateController,
    GithubController,
    GithubLinkController,
    ContestsController,
    AiController,
  ],
  providers: [
    NoticesService,
    CalendarService,
    PostsService,
    ProfileService,
    FilesService,
    StudiesService,
    SeminarsService,
    MissionsService,
    ProjectsService,
    QnaService,
    PollsService,
    PointsService,
    ActivityService,
    EventsService,
    KanbanService,
    HackathonService,
    PortfolioService,
    ChatService,
    ChatGateway,
    DuesService,
    CertificateService,
    GithubService,
    ContestsService,
    AiService,
  ],
})
export class MemberModule {}
