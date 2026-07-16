-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "autoPlayPronunciation" BOOLEAN NOT NULL DEFAULT true,
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
    "stripeCustomerId" TEXT,
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'trialing',
    "trialEndsAt" DATETIME,
    "billingConsentAt" DATETIME,
    "targetLanguageId" TEXT,
    CONSTRAINT "User_targetLanguageId_fkey" FOREIGN KEY ("targetLanguageId") REFERENCES "Language" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("assumedCheckPerDay", "autoPlayPronunciation", "cardTextSize", "createdAt", "dailyNewWords", "desiredRetention", "email", "emailVerified", "fuzzIntervals", "id", "intervalModifier", "lapseModifier", "masteryThresholdDays", "name", "passwordHash", "preferredAlgorithm", "settings", "showReading", "soundEffects", "studyTheme", "targetLanguageId", "theme", "updatedAt") SELECT "assumedCheckPerDay", "autoPlayPronunciation", "cardTextSize", "createdAt", "dailyNewWords", "desiredRetention", "email", "emailVerified", "fuzzIntervals", "id", "intervalModifier", "lapseModifier", "masteryThresholdDays", "name", "passwordHash", "preferredAlgorithm", "settings", "showReading", "soundEffects", "studyTheme", "targetLanguageId", "theme", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "EmailLog_userId_kind_key" ON "EmailLog"("userId", "kind");
