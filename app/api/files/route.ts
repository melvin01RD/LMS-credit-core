import { NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api/error-handler";
import { getLoans, createLoan } from "@/lib/services";
import type { LoanStatus, PaymentFrequency } from "@prisma/client";

/**
 * GET /api/loans
 * Lista préstamos con filtros opcionales y paginación
 *
 * Query params:
 *  - page (number)        → página actual (default: 1)
 *  - limit (number)       → registros por página (default: 20)
 *  - clientId (string)    → filtrar por cliente
 *  - status (LoanStatus)  → filtrar por estado: ACTIVE | OVERDUE | PAID | CANCELED
 *  - createdById (string) → filtrar por usuario que creó el préstamo
 *  - search (string)      → búsqueda por nombre/documento del cliente
 */
export const GET = withErrorHandler(async (req) => {
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
 * POST /api/loans
 * Crea un nuevo préstamo
 *
 * Body (JSON):
 *  - clientId (string)              → ID del cliente
 *  - principalAmount (number)       → monto del capital
 *  - annualInterestRate (number)    → tasa de interés anual (%)
 *  - paymentFrequency (string)      → WEEKLY | BIWEEKLY | MONTHLY
 *  - termCount (number)             → cantidad de cuotas
 *  - createdById (string)           → ID del usuario que crea el préstamo
 *  - guarantees? (string)           → garantías (opcional)
 */
export const POST = withErrorHandler(async (req) => {
  const data = await req.json();

  // Validación básica de campos requeridos a nivel de API
  const requiredFields = ["clientId", "principalAmount", "annualInterestRate", "paymentFrequency", "termCount", "createdById"];
  const missing = requiredFields.filter((field) => data[field] === undefined || data[field] === null);

  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Campos requeridos faltantes: ${missing.join(", ")}` },
      { status: 400 }
    );
  }

  // Validaciones de tipo numéricas
  if (typeof data.principalAmount !== "number" || data.principalAmount <= 0) {
    return NextResponse.json(
      { error: "El monto principal debe ser un número mayor a cero" },
      { status: 400 }
    );
  }

  if (typeof data.annualInterestRate !== "number" || data.annualInterestRate < 0) {
    return NextResponse.json(
      { error: "La tasa de interés anual debe ser un número mayor o igual a cero" },
      { status: 400 }
    );
  }

  if (typeof data.termCount !== "number" || data.termCount < 1 || !Number.isInteger(data.termCount)) {
    return NextResponse.json(
      { error: "La cantidad de cuotas debe ser un entero mayor a cero" },
      { status: 400 }
    );
  }

  const validFrequencies: PaymentFrequency[] = ["WEEKLY", "BIWEEKLY", "MONTHLY"];
  if (!validFrequencies.includes(data.paymentFrequency)) {
    return NextResponse.json(
      { error: `Frecuencia de pago inválida. Valores permitidos: ${validFrequencies.join(", ")}` },
      { status: 400 }
    );
  }

  const loan = await createLoan({
    clientId: data.clientId,
    principalAmount: data.principalAmount,
    annualInterestRate: data.annualInterestRate,
    paymentFrequency: data.paymentFrequency,
    termCount: data.termCount,
    createdById: data.createdById,
    guarantees: data.guarantees,
  });

  return NextResponse.json(loan, { status: 201 });
});
