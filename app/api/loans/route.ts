import { NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api/error-handler";
import { createLoan, getLoans } from "@/lib/services";
import { LoanStatus } from "@prisma/client";

export const GET = withErrorHandler(async (req) => {
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

export const POST = withErrorHandler(async (req) => {
  const data = await req.json();
  const loan = await createLoan(data);
  return NextResponse.json(loan, { status: 201 });
});
