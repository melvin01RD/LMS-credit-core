import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth-middleware";
import { getLoanPayments, createPayment } from "@/lib/services";

export const GET = withAuth(async (req, context) => {
  const params = await context!.params;
  const payments = await getLoanPayments(params.id);
  return NextResponse.json(payments);
});

export const POST = withAuth(async (req, context) => {
  const params = await context!.params;
  const data = await req.json();
  
  const result = await createPayment({
    ...data,
    loanId: params.id,
  });
  
  return NextResponse.json(result, { status: 201 });
});
