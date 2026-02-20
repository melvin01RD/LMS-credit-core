import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth-middleware";
import { createLoan, getLoans } from "@/lib/services";
import { LoanStatus } from "@prisma/client";

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get("page") ?? 1);
  const limit = Number(searchParams.get("limit") ?? 20);
  const clientId = searchParams.get("clientId") ?? undefined;
  const status = searchParams.get("status") as LoanStatus | undefined;
  const search = searchParams.get("search") ?? undefined;

  const result = await getLoans(
    { clientId, status, search },
    { page, limit }
  );

  return NextResponse.json(result);
});

export const POST = withAuth(async (req) => {
  const body = await req.json();
  const loanStructure = body.loanStructure ?? "FRENCH_AMORTIZATION";

  if (loanStructure === "FRENCH_AMORTIZATION" && !body.annualInterestRate) {
    return NextResponse.json(
      { error: "annualInterestRate es requerido para amortización francesa" },
      { status: 400 }
    );
  }

  if (loanStructure === "FLAT_RATE" && body.totalFinanceCharge == null) {
    return NextResponse.json(
      { error: "totalFinanceCharge es requerido para Flat Rate" },
      { status: 400 }
    );
  }

  const loan = await createLoan({ ...body, loanStructure });
  return NextResponse.json(loan, { status: 201 });
});
