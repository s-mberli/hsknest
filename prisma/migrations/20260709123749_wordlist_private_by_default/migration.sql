-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WordList" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "languageId" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WordList_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WordList_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_WordList" ("createdAt", "createdById", "description", "id", "isPublic", "languageId", "name") SELECT "createdAt", "createdById", "description", "id", "isPublic", "languageId", "name" FROM "WordList";
DROP TABLE "WordList";
ALTER TABLE "new_WordList" RENAME TO "WordList";
CREATE INDEX "WordList_languageId_idx" ON "WordList"("languageId");
CREATE INDEX "WordList_createdById_idx" ON "WordList"("createdById");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
