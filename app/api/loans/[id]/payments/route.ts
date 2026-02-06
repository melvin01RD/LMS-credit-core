import { NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api/error-handler";
import { getLoanPayments, createPayment } from "@/lib/services";

export const GET = withErrorHandler(async (req, context) => {
  const params = await context!.params;
  const payments = await getLoanPayments(params.id);
  return NextResponse.json(payments);
});

export const POST = withErrorHandler(async (req, context) => {
  const params = await context!.params;
  const data = await req.json();
  
  const result = await createPayment({
    ...data,
    loanId: params.id,
  });
  
  return NextResponse.json(result, { status: 201 });
});
