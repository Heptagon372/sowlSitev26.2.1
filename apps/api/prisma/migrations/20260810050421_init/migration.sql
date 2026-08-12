-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "generation" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "interests" TEXT[],
    "experience" TEXT NOT NULL,
    "availableDays" TEXT[],
    "motivation" TEXT NOT NULL,
    "wantToBuild" TEXT,
    "agreedAt" TIMESTAMP(3) NOT NULL,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "generation" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "googleFormUrl" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecruitConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubStat" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "ClubStat_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Application_generation_createdAt_idx" ON "Application"("generation", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Application_generation_studentId_key" ON "Application"("generation", "studentId");
