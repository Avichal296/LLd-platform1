import { loadEnv } from "../src/load-env.ts";
loadEnv();

import { PrismaClient } from "@prisma/client";
import { PROBLEM_CATALOG } from "../src/catalog/problems.ts";

const prisma = new PrismaClient();

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
