-- AlterTable
ALTER TABLE "ClubEvent" ADD COLUMN     "capacity" INTEGER,
ADD COLUMN     "signupOpen" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "EventSignup" (
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventSignup_pkey" PRIMARY KEY ("eventId","userId")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "order" INTEGER NOT NULL DEFAULT 0,
    "assigneeId" TEXT,
    "milestoneId" TEXT,
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hackathon" (
    "id" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "theme" TEXT,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hackathon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HackathonTeam" (
    "id" TEXT NOT NULL,
    "hackathonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "idea" TEXT,
    "repoUrl" TEXT,
    "demoUrl" TEXT,
    "submittedAt" TIMESTAMP(3),
    "score" INTEGER,
    "rank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HackathonTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HackathonTeamMember" (
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HackathonTeamMember_pkey" PRIMARY KEY ("teamId","userId")
);

-- CreateTable
CREATE TABLE "ChatRoom" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DuesTerm" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DuesTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DuesPayment" (
    "termId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3),
    "amount" INTEGER NOT NULL DEFAULT 0,
    "method" TEXT,
    "note" TEXT,

    CONSTRAINT "DuesPayment_pkey" PRIMARY KEY ("termId","userId")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "termId" TEXT,
    "title" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "category" TEXT NOT NULL DEFAULT '기타',
    "spentAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contest" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "host" TEXT,
    "category" TEXT,
    "prize" TEXT,
    "summary" TEXT,
    "deadline" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "feedId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContestBookmark" (
    "contestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContestBookmark_pkey" PRIMARY KEY ("contestId","userId")
);

-- CreateTable
CREATE TABLE "ContestFeed" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastFetchedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContestFeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GithubCache" (
    "login" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GithubCache_pkey" PRIMARY KEY ("login")
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "generation" INTEGER,
    "summary" JSONB NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventSignup_userId_idx" ON "EventSignup"("userId");

-- CreateIndex
CREATE INDEX "Milestone_projectId_idx" ON "Milestone"("projectId");

-- CreateIndex
CREATE INDEX "ProjectTask_projectId_status_order_idx" ON "ProjectTask"("projectId", "status", "order");

-- CreateIndex
CREATE INDEX "Hackathon_startsAt_idx" ON "Hackathon"("startsAt");

-- CreateIndex
CREATE INDEX "HackathonTeam_hackathonId_idx" ON "HackathonTeam"("hackathonId");

-- CreateIndex
CREATE INDEX "HackathonTeamMember_userId_idx" ON "HackathonTeamMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatRoom_slug_key" ON "ChatRoom"("slug");

-- CreateIndex
CREATE INDEX "ChatMessage_roomId_createdAt_idx" ON "ChatMessage"("roomId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DuesTerm_name_key" ON "DuesTerm"("name");

-- CreateIndex
CREATE INDEX "DuesPayment_userId_idx" ON "DuesPayment"("userId");

-- CreateIndex
CREATE INDEX "Expense_spentAt_idx" ON "Expense"("spentAt");

-- CreateIndex
CREATE UNIQUE INDEX "Contest_url_key" ON "Contest"("url");

-- CreateIndex
CREATE INDEX "Contest_deadline_idx" ON "Contest"("deadline");

-- CreateIndex
CREATE INDEX "ContestBookmark_userId_idx" ON "ContestBookmark"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ContestFeed_url_key" ON "ContestFeed"("url");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_code_key" ON "Certificate"("code");

-- CreateIndex
CREATE INDEX "Certificate_userId_idx" ON "Certificate"("userId");

-- AddForeignKey
ALTER TABLE "EventSignup" ADD CONSTRAINT "EventSignup_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ClubEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSignup" ADD CONSTRAINT "EventSignup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HackathonTeam" ADD CONSTRAINT "HackathonTeam_hackathonId_fkey" FOREIGN KEY ("hackathonId") REFERENCES "Hackathon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HackathonTeamMember" ADD CONSTRAINT "HackathonTeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "HackathonTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HackathonTeamMember" ADD CONSTRAINT "HackathonTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuesPayment" ADD CONSTRAINT "DuesPayment_termId_fkey" FOREIGN KEY ("termId") REFERENCES "DuesTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuesPayment" ADD CONSTRAINT "DuesPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_termId_fkey" FOREIGN KEY ("termId") REFERENCES "DuesTerm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestBookmark" ADD CONSTRAINT "ContestBookmark_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestBookmark" ADD CONSTRAINT "ContestBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
