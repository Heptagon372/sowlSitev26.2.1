-- AlterTable
ALTER TABLE "SharedFile" ADD COLUMN     "studyId" TEXT;

-- CreateTable
CREATE TABLE "Study" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "topic" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECRUITING',
    "schedule" TEXT,
    "maxMembers" INTEGER NOT NULL DEFAULT 8,
    "generation" INTEGER,
    "leaderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Study_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyMember" (
    "studyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyMember_pkey" PRIMARY KEY ("studyId","userId")
);

-- CreateTable
CREATE TABLE "StudyWeek" (
    "id" TEXT NOT NULL,
    "studyId" TEXT NOT NULL,
    "weekNo" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "meetAt" TIMESTAMP(3),
    "done" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "StudyWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Seminar" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "speakerId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "slideUrl" TEXT,
    "points" INTEGER NOT NULL DEFAULT 5,
    "attendCode" TEXT,
    "codeOpenAt" TIMESTAMP(3),
    "codeEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Seminar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeminarAttendance" (
    "seminarId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeminarAttendance_pkey" PRIMARY KEY ("seminarId","userId")
);

-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 10,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionSubmission" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "link" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "feedback" TEXT,
    "score" INTEGER,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "MissionSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ONGOING',
    "techStack" TEXT[],
    "repoUrl" TEXT,
    "demoUrl" TEXT,
    "thumbnailUrl" TEXT,
    "generation" INTEGER,
    "ownerId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("projectId","userId")
);

-- CreateTable
CREATE TABLE "TeamPost" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "positions" TEXT[],
    "techStack" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "projectId" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamApplication" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "position" TEXT,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "tags" TEXT[],
    "views" INTEGER NOT NULL DEFAULT 0,
    "acceptedAnswerId" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Poll" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "multiple" BOOLEAN NOT NULL DEFAULT false,
    "anonymous" BOOLEAN NOT NULL DEFAULT true,
    "closesAt" TIMESTAMP(3),
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollOption" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PollOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollVote" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Study_status_createdAt_idx" ON "Study"("status", "createdAt");

-- CreateIndex
CREATE INDEX "StudyMember_userId_idx" ON "StudyMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyWeek_studyId_weekNo_key" ON "StudyWeek"("studyId", "weekNo");

-- CreateIndex
CREATE INDEX "Seminar_startsAt_idx" ON "Seminar"("startsAt");

-- CreateIndex
CREATE INDEX "SeminarAttendance_userId_idx" ON "SeminarAttendance"("userId");

-- CreateIndex
CREATE INDEX "Mission_dueAt_idx" ON "Mission"("dueAt");

-- CreateIndex
CREATE INDEX "MissionSubmission_userId_idx" ON "MissionSubmission"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MissionSubmission_missionId_userId_key" ON "MissionSubmission"("missionId", "userId");

-- CreateIndex
CREATE INDEX "Project_status_createdAt_idx" ON "Project"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");

-- CreateIndex
CREATE INDEX "TeamPost_status_createdAt_idx" ON "TeamPost"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TeamApplication_userId_idx" ON "TeamApplication"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamApplication_postId_userId_key" ON "TeamApplication"("postId", "userId");

-- CreateIndex
CREATE INDEX "Question_createdAt_idx" ON "Question"("createdAt");

-- CreateIndex
CREATE INDEX "Answer_questionId_idx" ON "Answer"("questionId");

-- CreateIndex
CREATE INDEX "Poll_createdAt_idx" ON "Poll"("createdAt");

-- CreateIndex
CREATE INDEX "PollOption_pollId_idx" ON "PollOption"("pollId");

-- CreateIndex
CREATE INDEX "PollVote_pollId_userId_idx" ON "PollVote"("pollId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PollVote_optionId_userId_key" ON "PollVote"("optionId", "userId");

-- CreateIndex
CREATE INDEX "PointLog_userId_createdAt_idx" ON "PointLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PointLog_createdAt_idx" ON "PointLog"("createdAt");

-- CreateIndex
CREATE INDEX "SharedFile_studyId_createdAt_idx" ON "SharedFile"("studyId", "createdAt");

-- AddForeignKey
ALTER TABLE "SharedFile" ADD CONSTRAINT "SharedFile_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "Study"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Study" ADD CONSTRAINT "Study_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyMember" ADD CONSTRAINT "StudyMember_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "Study"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyMember" ADD CONSTRAINT "StudyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyWeek" ADD CONSTRAINT "StudyWeek_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "Study"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seminar" ADD CONSTRAINT "Seminar_speakerId_fkey" FOREIGN KEY ("speakerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeminarAttendance" ADD CONSTRAINT "SeminarAttendance_seminarId_fkey" FOREIGN KEY ("seminarId") REFERENCES "Seminar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeminarAttendance" ADD CONSTRAINT "SeminarAttendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionSubmission" ADD CONSTRAINT "MissionSubmission_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionSubmission" ADD CONSTRAINT "MissionSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamPost" ADD CONSTRAINT "TeamPost_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamPost" ADD CONSTRAINT "TeamPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamApplication" ADD CONSTRAINT "TeamApplication_postId_fkey" FOREIGN KEY ("postId") REFERENCES "TeamPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamApplication" ADD CONSTRAINT "TeamApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollOption" ADD CONSTRAINT "PollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "PollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointLog" ADD CONSTRAINT "PointLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
