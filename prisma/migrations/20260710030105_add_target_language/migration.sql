-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "preferredAlgorithm" TEXT NOT NULL DEFAULT 'FSRS',
    "settings" JSONB,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "studyTheme" TEXT NOT NULL DEFAULT 'follow',
    "cardTextSize" TEXT NOT NULL DEFAULT 'normal',
    "showReading" BOOLEAN NOT NULL DEFAULT true,
    "soundEffects" BOOLEAN NOT NULL DEFAULT true,
    "dailyNewWords" INTEGER NOT NULL DEFAULT 10,
    "assumedCheckPerDay" INTEGER NOT NULL DEFAULT 3,
    "intervalModifier" REAL NOT NULL DEFAULT 1.0,
    "lapseModifier" REAL NOT NULL DEFAULT 0.0,
    "masteryThresholdDays" INTEGER,
    "fuzzIntervals" BOOLEAN NOT NULL DEFAULT true,
    "desiredRetention" REAL NOT NULL DEFAULT 0.90,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "emailVerified" DATETIME,
    "targetLanguageId" TEXT,
    CONSTRAINT "User_targetLanguageId_fkey" FOREIGN KEY ("targetLanguageId") REFERENCES "Language" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("assumedCheckPerDay", "cardTextSize", "createdAt", "dailyNewWords", "desiredRetention", "email", "emailVerified", "fuzzIntervals", "id", "intervalModifier", "lapseModifier", "masteryThresholdDays", "name", "passwordHash", "preferredAlgorithm", "settings", "showReading", "soundEffects", "studyTheme", "theme", "updatedAt") SELECT "assumedCheckPerDay", "cardTextSize", "createdAt", "dailyNewWords", "desiredRetention", "email", "emailVerified", "fuzzIntervals", "id", "intervalModifier", "lapseModifier", "masteryThresholdDays", "name", "passwordHash", "preferredAlgorithm", "settings", "showReading", "soundEffects", "studyTheme", "theme", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
