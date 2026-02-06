import { NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api/error-handler";
import { getTodayPayments } from "@/lib/services";

export const GET = withErrorHandler(async () => {
  const payments = await getTodayPayments();
  return NextResponse.json(payments);
});
