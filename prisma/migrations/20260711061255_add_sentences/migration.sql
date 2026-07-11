-- CreateTable
CREATE TABLE "Sentence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "languageId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "translation" TEXT NOT NULL,
    "phonetic" TEXT,
    "source" TEXT,
    "metadata" JSONB,
    CONSTRAINT "Sentence_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SentenceWord" (
    "sentenceId" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,

    PRIMARY KEY ("sentenceId", "wordId"),
    CONSTRAINT "SentenceWord_sentenceId_fkey" FOREIGN KEY ("sentenceId") REFERENCES "Sentence" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SentenceWord_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Sentence_languageId_text_key" ON "Sentence"("languageId", "text");

-- CreateIndex
CREATE INDEX "SentenceWord_wordId_idx" ON "SentenceWord"("wordId");
