import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth-middleware";
import { prisma } from "@/lib/db/prisma";
import { DayOfWeek, LoanStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const JS_DAY_TO_ENUM: Record<number, DayOfWeek> = {
  1: DayOfWeek.MONDAY,
  2: DayOfWeek.TUESDAY,
  3: DayOfWeek.WEDNESDAY,
  4: DayOfWeek.THURSDAY,
  5: DayOfWeek.FRIDAY,
  6: DayOfWeek.SATURDAY,
};

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const dayParam = searchParams.get("day");

  let day: DayOfWeek;

  if (dayParam && Object.values(DayOfWeek).includes(dayParam as DayOfWeek)) {
    day = dayParam as DayOfWeek;
  } else {
    // Default: día actual (0=Dom, 1=Lun, ... 6=Sáb)
    const jsDay = new Date().getDay();
    day = JS_DAY_TO_ENUM[jsDay] ?? DayOfWeek.MONDAY;
  }

  const clients = await prisma.client.findMany({
    where: {
      active: true,
      collectionDays: { has: day },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      documentId: true,
      collectionDays: true,
      loans: {
        where: { status: { in: [LoanStatus.ACTIVE, LoanStatus.OVERDUE] } },
        select: {
          id: true,
          principalAmount: true,
          installmentAmount: true,
          remainingCapital: true,
          status: true,
          nextDueDate: true,
          paymentFrequency: true,
          createdBy: {
            select: { firstName: true, lastName: true },
          },
        },
      },
    },
    orderBy: { firstName: "asc" },
  });

  return NextResponse.json({ day, clients });
});
