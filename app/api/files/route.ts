import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth-middleware";
import { getLoans, createLoan } from "@/lib/services";
import type { LoanStatus, PaymentFrequency } from "@prisma/client";

export const dynamic = 'force-dynamic';

/**
 * GET /api/files (alias de /api/loans)
 */
export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url);

  const filters = {
    clientId: searchParams.get("clientId") || undefined,
    status: (searchParams.get("status") as LoanStatus) || undefined,
    createdById: searchParams.get("createdById") || undefined,
    search: searchParams.get("search") || undefined,
  };

  const pagination = {
    page: Number(searchParams.get("page")) || 1,
    limit: Number(searchParams.get("limit")) || 20,
  };

  const result = await getLoans(filters, pagination);
  return NextResponse.json(result);
});

/**
 * POST /api/files
 * Crea un nuevo préstamo Flat Rate
 */
export const POST = withAuth(async (req) => {
  const data = await req.json();

  const requiredFields = ["clientId", "principalAmount", "totalFinanceCharge", "paymentFrequency", "termCount", "createdById"];
  const missing = requiredFields.filter((field) => data[field] === undefined || data[field] === null);

  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Campos requeridos faltantes: ${missing.join(", ")}` },
      { status: 400 }
    );
  }

  if (typeof data.principalAmount !== "number" || data.principalAmount <= 0) {
    return NextResponse.json(
      { error: "El monto principal debe ser un número mayor a cero" },
      { status: 400 }
    );
  }

  if (typeof data.totalFinanceCharge !== "number" || data.totalFinanceCharge < 0) {
    return NextResponse.json(
      { error: "El cargo financiero debe ser un número mayor o igual a cero" },
      { status: 400 }
    );
  }

  if (typeof data.termCount !== "number" || data.termCount < 1 || !Number.isInteger(data.termCount)) {
    return NextResponse.json(
      { error: "La cantidad de cuotas debe ser un entero mayor a cero" },
      { status: 400 }
    );
  }

  const validFrequencies: PaymentFrequency[] = ["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"];
  if (!validFrequencies.includes(data.paymentFrequency)) {
    return NextResponse.json(
      { error: `Frecuencia de pago inválida. Valores permitidos: ${validFrequencies.join(", ")}` },
      { status: 400 }
    );
  }

  const loan = await createLoan({
    loanStructure: "FLAT_RATE",
    clientId: data.clientId,
    principalAmount: data.principalAmount,
    totalFinanceCharge: data.totalFinanceCharge,
    paymentFrequency: data.paymentFrequency,
    termCount: data.termCount,
    createdById: data.createdById,
    guarantees: data.guarantees,
  });

  return NextResponse.json(loan, { status: 201 });
});
