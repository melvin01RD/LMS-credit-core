import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth-middleware";
import { prisma } from "@/lib/db/prisma";
import { DayOfWeek, LoanStatus, ScheduleStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const JS_DAY_TO_ENUM: Record<number, DayOfWeek> = {
  1: DayOfWeek.MONDAY,
  2: DayOfWeek.TUESDAY,
  3: DayOfWeek.WEDNESDAY,
  4: DayOfWeek.THURSDAY,
  5: DayOfWeek.FRIDAY,
  6: DayOfWeek.SATURDAY,
};

/** Número de día JS (getDay()) para cada valor del enum */
const DAY_ENUM_TO_JS: Record<DayOfWeek, number> = {
  MONDAY:    1,
  TUESDAY:   2,
  WEDNESDAY: 3,
  THURSDAY:  4,
  FRIDAY:    5,
  SATURDAY:  6,
};

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const dayParam = searchParams.get("day");

  let day: DayOfWeek;

  if (dayParam && Object.values(DayOfWeek).includes(dayParam as DayOfWeek)) {
    day = dayParam as DayOfWeek;
  } else {
    // Default: día actual (0=Dom, 1=Lun, … 6=Sáb)
    const jsDay = new Date().getDay();
    day = JS_DAY_TO_ENUM[jsDay] ?? DayOfWeek.MONDAY;
  }

  const targetJsDay = DAY_ENUM_TO_JS[day];

  // Traer todos los clientes activos con sus préstamos activos/vencidos
  // y la primera cuota pendiente de cada préstamo
  const allClients = await prisma.client.findMany({
    where: { active: true },
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
          paymentSchedule: {
            where: {
              status: {
                in: [ScheduleStatus.PENDING, ScheduleStatus.OVERDUE],
              },
            },
            orderBy: { installmentNumber: "asc" },
            take: 1,
          },
        },
      },
    },
    orderBy: { firstName: "asc" },
  });

  // Filtrar: un préstamo aparece en el día si:
  //   1. El cliente tiene collectionDays configurados manualmente y el día coincide, O
  //   2. La primera cuota pendiente del préstamo cae en ese día de la semana
  const clients = allClients
    .map((client) => {
      const hasManualDay = client.collectionDays.includes(day);

      const matchingLoans = client.loans
        .filter((loan) => {
          if (hasManualDay) return true;
          const firstPending = loan.paymentSchedule[0];
          if (!firstPending) return false;
          return new Date(firstPending.dueDate).getDay() === targetJsDay;
        })
        .map(({ paymentSchedule: _ps, ...loanData }) => loanData);

      return { ...client, loans: matchingLoans };
    })
    .filter((client) => client.loans.length > 0);

  return NextResponse.json({ day, clients });
});
