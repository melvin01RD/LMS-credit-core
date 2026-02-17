import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth-middleware";
import { getLoanAmortization } from "@/lib/services";

export const GET = withAuth(async (req, context) => {
  const params = await context!.params;
  const schedule = await getLoanAmortization(params.id);
  return NextResponse.json(schedule);
});
