import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const config = await prisma.systemConfig.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      businessName: "LMS Credit",
      lateFeeType: "PERCENTAGE_DAILY",
      lateFeeValue: 0,
      gracePeriodDays: 0,
    },
    update: {},
  });
  console.log("✅ SystemConfig singleton:", config.id, "—", config.businessName);
}

main()
  .catch((e) => { console.error("❌", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
