-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ReviewLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "guestId" TEXT,
    "wordId" TEXT NOT NULL,
    "quality" INTEGER NOT NULL,
    "algorithm" TEXT NOT NULL,
    "intervalBefore" REAL NOT NULL,
    "intervalAfter" REAL NOT NULL,
    "reviewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'srs',
    "latencyMs" INTEGER,
    CONSTRAINT "ReviewLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ReviewLog" ("algorithm", "guestId", "id", "intervalAfter", "intervalBefore", "quality", "reviewedAt", "userId", "wordId") SELECT "algorithm", "guestId", "id", "intervalAfter", "intervalBefore", "quality", "reviewedAt", "userId", "wordId" FROM "ReviewLog";
DROP TABLE "ReviewLog";
ALTER TABLE "new_ReviewLog" RENAME TO "ReviewLog";
CREATE INDEX "ReviewLog_userId_reviewedAt_idx" ON "ReviewLog"("userId", "reviewedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
