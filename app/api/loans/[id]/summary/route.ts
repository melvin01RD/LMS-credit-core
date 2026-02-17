import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth-middleware";
import { getLoanSummary } from "@/lib/services";

export const GET = withAuth(async (req, context) => {
  const params = await context!.params;
  const summary = await getLoanSummary(params.id);
  return NextResponse.json(summary);
});
