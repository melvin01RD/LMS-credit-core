import { NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api/error-handler";
import { getPaymentById } from "@/lib/services";

export const GET = withErrorHandler(async (req, context) => {
  const params = await context!.params;
  const payment = await getPaymentById(params.id);
  return NextResponse.json(payment);
});
