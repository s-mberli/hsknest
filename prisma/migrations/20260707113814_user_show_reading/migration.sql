-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "preferredAlgorithm" TEXT NOT NULL DEFAULT 'SM2',
    "settings" JSONB,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "studyTheme" TEXT NOT NULL DEFAULT 'follow',
    "cardTextSize" TEXT NOT NULL DEFAULT 'normal',
    "showReading" BOOLEAN NOT NULL DEFAULT true,
    "dailyNewWords" INTEGER NOT NULL DEFAULT 10,
    "assumedCheckPerDay" INTEGER NOT NULL DEFAULT 3,
    "intervalModifier" REAL NOT NULL DEFAULT 1.0,
    "lapseModifier" REAL NOT NULL DEFAULT 0.0,
    "masteryThresholdDays" INTEGER,
    "fuzzIntervals" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("assumedCheckPerDay", "cardTextSize", "createdAt", "dailyNewWords", "email", "fuzzIntervals", "id", "intervalModifier", "lapseModifier", "masteryThresholdDays", "name", "passwordHash", "preferredAlgorithm", "settings", "studyTheme", "theme", "updatedAt") SELECT "assumedCheckPerDay", "cardTextSize", "createdAt", "dailyNewWords", "email", "fuzzIntervals", "id", "intervalModifier", "lapseModifier", "masteryThresholdDays", "name", "passwordHash", "preferredAlgorithm", "settings", "studyTheme", "theme", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
