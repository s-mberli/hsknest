const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.log("Deleting review logs...");
  await prisma.reviewLog.deleteMany({});

  console.log("Deleting user progress...");
  await prisma.userProgress.deleteMany({});

  console.log("Deleting users...");
  await prisma.user.deleteMany({});

  console.log("Deleting legacy lists...");
  const deleted = await prisma.wordList.deleteMany({
    where: { name: { endsWith: " (legacy)" } },
  });
  console.log(`Deleted ${deleted.count} legacy lists`);

  console.log("Reset complete!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
