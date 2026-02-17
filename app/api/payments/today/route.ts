import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth-middleware";
import { getTodayPayments } from "@/lib/services";

export const GET = withAuth(async () => {
  const payments = await getTodayPayments();
  return NextResponse.json(payments);
});
