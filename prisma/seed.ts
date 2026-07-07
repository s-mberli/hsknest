import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type SeedWord = {
  term: string;
  translation: string;
  phonetic: string;
  metadata: Prisma.InputJsonValue;
};

// Everyday Conversations — functional speech for getting by day-to-day.
const zhEverydayWords: SeedWord[] = [
  { term: "请问", translation: "excuse me (may I ask)", phonetic: "qǐngwèn", metadata: { tones: [3, 4], pos: "phrase" } },
  { term: "没关系", translation: "it doesn't matter; no problem", phonetic: "méi guānxi", metadata: { tones: [2, 1, 0], pos: "phrase" } },
  { term: "不客气", translation: "you're welcome", phonetic: "bú kèqi", metadata: { tones: [2, 4, 0], pos: "phrase" } },
  { term: "对不起", translation: "sorry", phonetic: "duìbuqǐ", metadata: { tones: [4, 0, 3], pos: "phrase" } },
  { term: "可以", translation: "can; may; OK", phonetic: "kěyǐ", metadata: { tones: [3, 3], pos: "verb" } },
  { term: "帮忙", translation: "to help", phonetic: "bāngmáng", metadata: { tones: [1, 2], pos: "verb" } },
  { term: "多少钱", translation: "how much (money)", phonetic: "duōshao qián", metadata: { tones: [1, 0, 2], pos: "phrase" } },
  { term: "好吃", translation: "tasty; delicious", phonetic: "hǎochī", metadata: { tones: [3, 1], pos: "adjective" } },
  { term: "打电话", translation: "to make a phone call", phonetic: "dǎ diànhuà", metadata: { tones: [3, 4, 4], pos: "verb" } },
  { term: "见面", translation: "to meet (up)", phonetic: "jiànmiàn", metadata: { tones: [4, 4], pos: "verb" } },
  { term: "一起", translation: "together", phonetic: "yìqǐ", metadata: { tones: [4, 3], pos: "adverb" } },
  { term: "慢一点", translation: "a bit slower", phonetic: "màn yìdiǎn", metadata: { tones: [4, 4, 3], pos: "phrase" } },
  { term: "等一下", translation: "wait a moment", phonetic: "děng yíxià", metadata: { tones: [3, 2, 4], pos: "phrase" } },
  { term: "没问题", translation: "no problem", phonetic: "méi wèntí", metadata: { tones: [2, 4, 2], pos: "phrase" } },
  { term: "知道", translation: "to know", phonetic: "zhīdào", metadata: { tones: [1, 4], pos: "verb" } },
  { term: "喜欢", translation: "to like", phonetic: "xǐhuan", metadata: { tones: [3, 0], pos: "verb" } },
  { term: "想", translation: "to want; to think", phonetic: "xiǎng", metadata: { tones: [3], pos: "verb" } },
  { term: "需要", translation: "to need", phonetic: "xūyào", metadata: { tones: [1, 4], pos: "verb" } },
  { term: "厕所", translation: "toilet; restroom", phonetic: "cèsuǒ", metadata: { tones: [4, 3], pos: "noun" } },
  { term: "几点", translation: "what time", phonetic: "jǐ diǎn", metadata: { tones: [3, 3], pos: "phrase" } },
  { term: "多远", translation: "how far", phonetic: "duō yuǎn", metadata: { tones: [1, 3], pos: "phrase" } },
  { term: "怎么走", translation: "how do I get there", phonetic: "zěnme zǒu", metadata: { tones: [3, 0, 3], pos: "phrase" } },
  { term: "买单", translation: "to pay the bill", phonetic: "mǎidān", metadata: { tones: [3, 1], pos: "verb" } },
  { term: "便宜", translation: "cheap", phonetic: "piányi", metadata: { tones: [2, 0], pos: "adjective" } },
  { term: "太贵了", translation: "too expensive", phonetic: "tài guì le", metadata: { tones: [4, 4, 0], pos: "phrase" } },
  { term: "点菜", translation: "to order dishes", phonetic: "diǎncài", metadata: { tones: [3, 4], pos: "verb" } },
  { term: "还是", translation: "or (in questions); still", phonetic: "háishi", metadata: { tones: [2, 0], pos: "conjunction" } },
  { term: "当然", translation: "of course", phonetic: "dāngrán", metadata: { tones: [1, 2], pos: "adverb" } },
  { term: "再说一遍", translation: "say it again", phonetic: "zài shuō yí biàn", metadata: { tones: [4, 1, 2, 4], pos: "phrase" } },
  { term: "听不懂", translation: "can't understand (by ear)", phonetic: "tīng bu dǒng", metadata: { tones: [1, 0, 3], pos: "phrase" } },
];

// Reading the News — formal/media register for headlines and reporting.
const zhNewsWords: SeedWord[] = [
  { term: "政府", translation: "government", phonetic: "zhèngfǔ", metadata: { tones: [4, 3], pos: "noun" } },
  { term: "经济", translation: "economy", phonetic: "jīngjì", metadata: { tones: [1, 4], pos: "noun" } },
  { term: "发展", translation: "to develop; development", phonetic: "fāzhǎn", metadata: { tones: [1, 3], pos: "verb" } },
  { term: "国际", translation: "international", phonetic: "guójì", metadata: { tones: [2, 4], pos: "adjective" } },
  { term: "报道", translation: "to report; news report", phonetic: "bàodào", metadata: { tones: [4, 4], pos: "noun" } },
  { term: "增长", translation: "to grow; growth", phonetic: "zēngzhǎng", metadata: { tones: [1, 3], pos: "verb" } },
  { term: "表示", translation: "to express; to state", phonetic: "biǎoshì", metadata: { tones: [3, 4], pos: "verb" } },
  { term: "影响", translation: "to affect; influence", phonetic: "yǐngxiǎng", metadata: { tones: [3, 3], pos: "noun" } },
  { term: "市场", translation: "market", phonetic: "shìchǎng", metadata: { tones: [4, 3], pos: "noun" } },
  { term: "政策", translation: "policy", phonetic: "zhèngcè", metadata: { tones: [4, 4], pos: "noun" } },
  { term: "社会", translation: "society", phonetic: "shèhuì", metadata: { tones: [4, 4], pos: "noun" } },
  { term: "环境", translation: "environment", phonetic: "huánjìng", metadata: { tones: [2, 4], pos: "noun" } },
  { term: "企业", translation: "enterprise; company", phonetic: "qǐyè", metadata: { tones: [3, 4], pos: "noun" } },
  { term: "投资", translation: "to invest; investment", phonetic: "tóuzī", metadata: { tones: [2, 1], pos: "noun" } },
  { term: "贸易", translation: "trade", phonetic: "màoyì", metadata: { tones: [4, 4], pos: "noun" } },
  { term: "科技", translation: "science and technology", phonetic: "kējì", metadata: { tones: [1, 4], pos: "noun" } },
  { term: "教育", translation: "education", phonetic: "jiàoyù", metadata: { tones: [4, 4], pos: "noun" } },
  { term: "医疗", translation: "medical care", phonetic: "yīliáo", metadata: { tones: [1, 2], pos: "noun" } },
  { term: "危机", translation: "crisis", phonetic: "wēijī", metadata: { tones: [1, 1], pos: "noun" } },
  { term: "改革", translation: "reform", phonetic: "gǎigé", metadata: { tones: [3, 2], pos: "noun" } },
  { term: "领导", translation: "leader; to lead", phonetic: "lǐngdǎo", metadata: { tones: [3, 3], pos: "noun" } },
  { term: "会议", translation: "meeting; conference", phonetic: "huìyì", metadata: { tones: [4, 4], pos: "noun" } },
  { term: "宣布", translation: "to announce", phonetic: "xuānbù", metadata: { tones: [1, 4], pos: "verb" } },
  { term: "签署", translation: "to sign (an agreement)", phonetic: "qiānshǔ", metadata: { tones: [1, 3], pos: "verb" } },
  { term: "协议", translation: "agreement", phonetic: "xiéyì", metadata: { tones: [2, 4], pos: "noun" } },
  { term: "数据", translation: "data", phonetic: "shùjù", metadata: { tones: [4, 4], pos: "noun" } },
  { term: "预计", translation: "to estimate; to forecast", phonetic: "yùjì", metadata: { tones: [4, 4], pos: "verb" } },
  { term: "记者", translation: "reporter; journalist", phonetic: "jìzhě", metadata: { tones: [4, 3], pos: "noun" } },
  { term: "调查", translation: "investigation; survey", phonetic: "diàochá", metadata: { tones: [4, 2], pos: "noun" } },
  { term: "面临", translation: "to face; to be confronted with", phonetic: "miànlín", metadata: { tones: [4, 2], pos: "verb" } },
];

// Spanish — grammatical gender lives in metadata.
const esWords: SeedWord[] = [
  { term: "hola", translation: "hello", phonetic: "ˈo.la", metadata: { pos: "interjection" } },
  { term: "gracias", translation: "thank you", phonetic: "ˈɡɾa.sjas", metadata: { pos: "interjection" } },
  { term: "adiós", translation: "goodbye", phonetic: "aˈðjos", metadata: { pos: "interjection" } },
  { term: "agua", translation: "water", phonetic: "ˈa.ɣwa", metadata: { gender: "feminine", pos: "noun" } },
  { term: "casa", translation: "house", phonetic: "ˈka.sa", metadata: { gender: "feminine", pos: "noun" } },
  { term: "libro", translation: "book", phonetic: "ˈli.βɾo", metadata: { gender: "masculine", pos: "noun" } },
  { term: "amigo", translation: "friend", phonetic: "aˈmi.ɣo", metadata: { gender: "masculine", pos: "noun" } },
  { term: "escuela", translation: "school", phonetic: "esˈkwe.la", metadata: { gender: "feminine", pos: "noun" } },
  { term: "maestro", translation: "teacher", phonetic: "maˈes.tɾo", metadata: { gender: "masculine", pos: "noun" } },
  { term: "comer", translation: "to eat", phonetic: "koˈmeɾ", metadata: { pos: "verb" } },
  { term: "beber", translation: "to drink", phonetic: "beˈβeɾ", metadata: { pos: "verb" } },
  { term: "leer", translation: "to read", phonetic: "leˈeɾ", metadata: { pos: "verb" } },
  { term: "grande", translation: "big", phonetic: "ˈɡɾan.de", metadata: { pos: "adjective" } },
  { term: "pequeño", translation: "small", phonetic: "peˈke.ɲo", metadata: { pos: "adjective" } },
  { term: "bueno", translation: "good", phonetic: "ˈbwe.no", metadata: { pos: "adjective" } },
  { term: "familia", translation: "family", phonetic: "faˈmi.lja", metadata: { gender: "feminine", pos: "noun" } },
  { term: "España", translation: "Spain", phonetic: "esˈpa.ɲa", metadata: { gender: "feminine", pos: "noun" } },
  { term: "hoy", translation: "today", phonetic: "oi", metadata: { pos: "adverb" } },
  { term: "mañana", translation: "tomorrow", phonetic: "maˈɲa.na", metadata: { pos: "adverb" } },
  { term: "amar", translation: "to love", phonetic: "aˈmaɾ", metadata: { pos: "verb" } },
];

/** Load a prepared vocabulary file from prisma/data/hsk as SeedWords. */
function loadWords(file: string): SeedWord[] {
  const path = join(__dirname, "data", "hsk", `${file}.json`);
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as SeedWord[];
}

/** Create the language if missing, keeping its name in sync. */
async function upsertLanguage(code: string, name: string) {
  return prisma.language.upsert({
    where: { code },
    update: { name },
    create: { code, name },
  });
}

/** How many progress rows hang off a list's words (0 = safe to replace). */
async function progressCount(listId: string): Promise<number> {
  return prisma.userProgress.count({
    where: { word: { wordListId: listId } },
  });
}

/** Delete a seeded list plus its ReviewLog rows (no FK, cleared by hand). */
async function deleteSeededList(listId: string) {
  const words = await prisma.word.findMany({
    where: { wordListId: listId },
    select: { id: true },
  });
  await prisma.$transaction([
    prisma.reviewLog.deleteMany({
      where: { wordId: { in: words.map((w) => w.id) } },
    }),
    // Cascade handles words + their UserProgress.
    prisma.wordList.delete({ where: { id: listId } }),
  ]);
}

/**
 * Idempotently seed a word list, refreshing outdated content:
 * - missing → create with words;
 * - exists with the same word count → assumed current, no-op;
 * - exists with a different word count (outdated dataset) → replace when no
 *   user progress references it, otherwise rename the old list to
 *   "… (legacy)" and create the new one — never touch studied content.
 */
async function seedList(
  languageId: string,
  name: string,
  description: string,
  words: SeedWord[]
) {
  const existing = await prisma.wordList.findFirst({
    where: { languageId, name, createdById: null },
    select: { id: true, _count: { select: { words: true } } },
  });

  if (existing) {
    if (existing._count.words === words.length) return; // current
    if ((await progressCount(existing.id)) === 0) {
      await deleteSeededList(existing.id);
      console.log(`Replacing outdated list: ${name}`);
    } else {
      await prisma.wordList.update({
        where: { id: existing.id },
        data: { name: `${name} (legacy)` },
      });
      console.log(`Kept studied list as: ${name} (legacy)`);
    }
  }

  const list = await prisma.wordList.create({
    data: { name, description, isPublic: true, languageId },
    select: { id: true },
  });

  await prisma.word.createMany({
    data: words.map((w, i) => ({
      term: w.term,
      translation: w.translation,
      phonetic: w.phonetic,
      metadata: w.metadata as Prisma.InputJsonValue,
      wordListId: list.id,
      position: i,
    })),
  });
  console.log(`Seeded: ${name} (${words.length} words)`);
}

// New HSK 3.0 (2021 standard) levels + general frequency lists. File names
// map to prisma/data/hsk/<file>.json built from complete-hsk-vocabulary (MIT).
const ZH_LISTS: { file: string; name: string; description: string }[] = [
  { file: "new1", name: "HSK 1 — Foundation", description: "The first ~500 words of the current (2021) HSK standard." },
  { file: "new2", name: "HSK 2 — Elementary", description: "Common verbs, times, and places — HSK 3.0 level 2." },
  { file: "new3", name: "HSK 3 — Intermediate", description: "Everyday topics: travel, work, and simple opinions." },
  { file: "new4", name: "HSK 4 — Upper Intermediate", description: "Richer vocabulary for experiences and abstract ideas." },
  { file: "new5", name: "HSK 5 — Advanced", description: "Nuanced words for news, culture, and detailed discussion." },
  { file: "new6", name: "HSK 6 — Proficient", description: "Advanced vocabulary approaching full working fluency." },
  { file: "new7", name: "HSK 7–9 — Mastery", description: "The top band of the 2021 standard for near-native reading." },
  { file: "freq100", name: "Top 100 Most Common Words", description: "The 100 highest-frequency words — the fastest possible start." },
  { file: "freq1000", name: "Top 1000 Most Common Words", description: "The 1000 highest-frequency words, ordered by real-world usage." },
];

// HSK 2.0 list names that no longer exist in the 2021 lineup. Retired only
// when untouched; renamed to "… (legacy)" when a user has progress in them.
const RETIRED_ZH_LISTS = ["HSK 6 — Mastery"];

/**
 * Retire a seeded list whose name left the lineup: delete when untouched,
 * rename to "… (legacy)" when a user has progress in it. Idempotent.
 */
async function retireSeededList(name: string) {
  const list = await prisma.wordList.findFirst({
    where: { name, createdById: null },
    select: { id: true },
  });
  if (!list) return;

  if ((await progressCount(list.id)) === 0) {
    await deleteSeededList(list.id);
    console.log(`Removed retired list: ${name}`);
  } else {
    await prisma.wordList.update({
      where: { id: list.id },
      data: { name: `${name} (legacy)` },
    });
    console.log(`Kept studied retired list as: ${name} (legacy)`);
  }
}

async function main() {
  // Retired test content — drop from any existing DB.
  await retireSeededList("Everyday Mandarin Starter");
  for (const name of RETIRED_ZH_LISTS) {
    await retireSeededList(name);
  }

  const zh = await upsertLanguage("zh", "Mandarin Chinese");

  for (const { file, name, description } of ZH_LISTS) {
    await seedList(zh.id, name, description, loadWords(file));
  }

  await seedList(
    zh.id,
    "Everyday Conversations",
    "Practical phrases for shops, directions, and small talk.",
    zhEverydayWords
  );
  await seedList(
    zh.id,
    "Reading the News",
    "Formal media vocabulary for headlines and reporting.",
    zhNewsWords
  );

  const es = await upsertLanguage("es", "Spanish");
  await seedList(
    es.id,
    "Everyday Spanish Starter",
    "A first set of common Spanish words and phrases.",
    esWords
  );

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
