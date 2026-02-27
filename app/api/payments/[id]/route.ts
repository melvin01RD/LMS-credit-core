import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth-middleware";
import { getPaymentById } from "@/lib/services";

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req, context) => {
  const params = await context!.params;
  const payment = await getPaymentById(params.id);
  return NextResponse.json(payment);
});
