import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const loans = await prisma.loan.findMany({
    where: { status: "ACTIVE" },
    include: { client: true },
    take: 5,
  });

  console.log("Total ACTIVE loans:", loans.length);
  for (const l of loans) {
    console.log(
      `${l.client.firstName} ${l.client.lastName ?? ""} | ${l.client.documentId} | balance:${l.remainingCapital} | installment:${l.installmentAmount}`
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
