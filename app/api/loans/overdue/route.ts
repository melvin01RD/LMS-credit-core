import { NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api/error-handler";
import { processOverdueLoans, getOverdueLoans } from "@/lib/services";

export const GET = withErrorHandler(async () => {
  const overdueLoans = await getOverdueLoans();
  return NextResponse.json(overdueLoans);
});

export const POST = withErrorHandler(async (req) => {
  const { userId } = await req.json();

  if (!userId) {
    return NextResponse.json(
      { error: { code: "MISSING_USER_ID", message: "userId es requerido" } },
      { status: 400 }
    );
  }

  const result = await processOverdueLoans(userId);
  return NextResponse.json(result);
});
