const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const lists = await prisma.wordList.findMany({
    where: { name: { contains: "HSK" }, createdById: null },
    select: { id: true, name: true, _count: { select: { words: true } } },
    orderBy: { name: "asc" },
  });

  console.log("\n=== HSK Curation Status ===\n");

  for (const list of lists) {
    const words = await prisma.word.findMany({
      where: { wordListId: list.id },
      select: { metadata: true },
      take: 50,
    });

    const wordsWithMeanings = words.filter((w) => w.metadata?.meanings);
    const avgGlosses =
      wordsWithMeanings.length > 0
        ? (
            wordsWithMeanings.reduce((sum, w) => sum + (w.metadata.meanings?.length || 0), 0) /
            wordsWithMeanings.length
          ).toFixed(1)
        : "0";

    console.log(
      `${list.name}: ${list._count.words} words | ${wordsWithMeanings.length}/50 sampled have meanings | avg ${avgGlosses} glosses`
    );
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
