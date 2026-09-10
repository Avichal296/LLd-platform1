import { loadEnv } from "../src/load-env.ts";
loadEnv();
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@prisma/client";
import { PROBLEM_CATALOG } from "../src/catalog/problems.ts";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});
async function main() {
  for (const p of PROBLEM_CATALOG) {
    await prisma.problem.upsert({
      where: { id: p.id },
      create: p,
      update: p,
    });
  }
  console.log(`seeded ${PROBLEM_CATALOG.length} problems`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
