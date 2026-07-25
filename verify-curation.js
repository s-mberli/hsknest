const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const list = await prisma.wordList.findFirst({
    where: { name: "HSK 1 — Foundation" },
  });

  if (!list) {
    console.log("HSK 1 list not found");
    return;
  }

  const words = await prisma.word.findMany({
    where: { wordListId: list.id, term: { in: ["的", "了", "我", "是", "你"] } },
    select: { term: true, translation: true, metadata: true },
  });

  console.log("\n=== HSK 1 Curated Words ===\n");
  for (const word of words) {
    const meanings = word.metadata?.meanings || [];
    console.log(`${word.term}: ${meanings.length} gloss(es)`);
    meanings.forEach((m, i) => {
      console.log(`  ${i + 1}. ${m.gloss}`);
    });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
