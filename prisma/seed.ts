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

/** Load a prepared HSK level file (frequency-sorted) as SeedWords. */
function loadHskWords(level: number): SeedWord[] {
  const path = join(__dirname, "data", "hsk", `hsk${level}.json`);
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

/**
 * Idempotently seed a word list: skip if a list with this name already exists
 * for the language, otherwise create it with its words (position by index).
 */
async function seedList(
  languageId: string,
  name: string,
  description: string,
  words: SeedWord[]
) {
  const existing = await prisma.wordList.findFirst({
    where: { languageId, name },
    select: { id: true },
  });
  if (existing) return;

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
}

const HSK_LISTS: { level: number; name: string; description: string }[] = [
  { level: 1, name: "HSK 1 — Foundation", description: "The first 150 words: greetings, numbers, and everyday essentials." },
  { level: 2, name: "HSK 2 — Elementary", description: "Build on the basics with common verbs, times, and places." },
  { level: 3, name: "HSK 3 — Intermediate", description: "Everyday topics — travel, work, and simple opinions." },
  { level: 4, name: "HSK 4 — Upper Intermediate", description: "Richer vocabulary for describing experiences and abstract ideas." },
  { level: 5, name: "HSK 5 — Advanced", description: "Nuanced words for news, culture, and detailed discussion." },
  { level: 6, name: "HSK 6 — Mastery", description: "The full advanced set for reading and near-native fluency." },
];

/**
 * Idempotently remove a retired seeded list (createdById null) and everything
 * hanging off it. WordList→Word and Word→UserProgress cascade on delete, but
 * ReviewLog has no FK to Word (only scalar wordId), so its rows are cleared by
 * hand first. No-ops when the list is already gone.
 */
async function removeSeededList(name: string) {
  const list = await prisma.wordList.findFirst({
    where: { name, createdById: null },
    select: { id: true, words: { select: { id: true } } },
  });
  if (!list) return;

  const wordIds = list.words.map((w) => w.id);
  await prisma.$transaction([
    prisma.reviewLog.deleteMany({ where: { wordId: { in: wordIds } } }),
    // Cascade handles words + their UserProgress.
    prisma.wordList.delete({ where: { id: list.id } }),
  ]);
  console.log(`Removed retired list: ${name}`);
}

async function main() {
  // Retired test content — drop from any existing DB.
  await removeSeededList("Everyday Mandarin Starter");

  const zh = await upsertLanguage("zh", "Mandarin Chinese");

  for (const { level, name, description } of HSK_LISTS) {
    await seedList(zh.id, name, description, loadHskWords(level));
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
