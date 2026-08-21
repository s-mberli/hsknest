-- CreateTable
CREATE TABLE "ReadingText" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "languageId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "topic" TEXT,
    "bodyRaw" TEXT NOT NULL,
    "bodyHydrated" JSONB,
    "gradeReport" JSONB,
    "source" TEXT,
    "license" TEXT,
    "attribution" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "estimatedMin" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReadingText_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReadingTextWord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "textId" TEXT NOT NULL,
    "lemma" TEXT NOT NULL,
    "level" INTEGER,
    "position" INTEGER NOT NULL,
    CONSTRAINT "ReadingTextWord_textId_fkey" FOREIGN KEY ("textId") REFERENCES "ReadingText" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReadingAudio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "textId" TEXT NOT NULL,
    "voice" TEXT NOT NULL,
    "audioUrl" TEXT NOT NULL,
    "timingsUrl" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReadingAudio_textId_fkey" FOREIGN KEY ("textId") REFERENCES "ReadingText" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReadingProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "textId" TEXT NOT NULL,
    "lastPosition" INTEGER NOT NULL DEFAULT 0,
    "completedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReadingProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReadingProgress_textId_fkey" FOREIGN KEY ("textId") REFERENCES "ReadingText" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WordEncounter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "languageId" TEXT NOT NULL,
    "lemma" TEXT NOT NULL,
    "lookups" INTEGER NOT NULL DEFAULT 1,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "addedWordId" TEXT,
    CONSTRAINT "WordEncounter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WordEncounter_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ReadingText_languageId_level_idx" ON "ReadingText"("languageId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "ReadingText_languageId_slug_key" ON "ReadingText"("languageId", "slug");

-- CreateIndex
CREATE INDEX "ReadingTextWord_textId_level_idx" ON "ReadingTextWord"("textId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "ReadingTextWord_textId_lemma_key" ON "ReadingTextWord"("textId", "lemma");

-- CreateIndex
CREATE UNIQUE INDEX "ReadingAudio_textId_key" ON "ReadingAudio"("textId");

-- CreateIndex
CREATE UNIQUE INDEX "ReadingProgress_userId_textId_key" ON "ReadingProgress"("userId", "textId");

-- CreateIndex
CREATE INDEX "WordEncounter_userId_languageId_idx" ON "WordEncounter"("userId", "languageId");

-- CreateIndex
CREATE UNIQUE INDEX "WordEncounter_userId_lemma_key" ON "WordEncounter"("userId", "lemma");
