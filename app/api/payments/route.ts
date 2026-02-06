import { NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api/error-handler";
import { getPayments } from "@/lib/services";
import { PaymentType } from "@prisma/client";

export const GET = withErrorHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get("page") ?? 1);
  const limit = Number(searchParams.get("limit") ?? 20);
  const loanId = searchParams.get("loanId") ?? undefined;
  const type = searchParams.get("type") as PaymentType | undefined;
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const result = await getPayments(
    {
      loanId,
      type,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
    },
    { page, limit }
  );

  return NextResponse.json(result);
});
