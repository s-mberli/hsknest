-- CreateTable
CREATE TABLE "HiddenList" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    CONSTRAINT "HiddenList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HiddenList_listId_fkey" FOREIGN KEY ("listId") REFERENCES "WordList" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "HiddenList_userId_listId_key" ON "HiddenList"("userId", "listId");
