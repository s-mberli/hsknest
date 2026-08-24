-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WordEncounter" (
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
INSERT INTO "new_WordEncounter" ("addedWordId", "id", "languageId", "lastSeenAt", "lemma", "lookups", "userId") SELECT "addedWordId", "id", "languageId", "lastSeenAt", "lemma", "lookups", "userId" FROM "WordEncounter";
DROP TABLE "WordEncounter";
ALTER TABLE "new_WordEncounter" RENAME TO "WordEncounter";
CREATE UNIQUE INDEX "WordEncounter_userId_languageId_lemma_key" ON "WordEncounter"("userId", "languageId", "lemma");
CREATE INDEX "WordEncounter_userId_languageId_idx" ON "WordEncounter"("userId", "languageId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
