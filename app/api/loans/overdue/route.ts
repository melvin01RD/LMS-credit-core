import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth-middleware";
import { processOverdueLoans, getOverdueLoans } from "@/lib/services";

export const dynamic = 'force-dynamic';

export const GET = withAuth(async () => {
  const overdueLoans = await getOverdueLoans();
  return NextResponse.json(overdueLoans);
});

export const POST = withAuth(async (req) => {
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
