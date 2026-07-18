-- CreateTable
CREATE TABLE "ListPriority" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "wordListId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    CONSTRAINT "ListPriority_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ListPriority_wordListId_fkey" FOREIGN KEY ("wordListId") REFERENCES "WordList" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ListPriority_userId_idx" ON "ListPriority"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ListPriority_userId_wordListId_key" ON "ListPriority"("userId", "wordListId");
