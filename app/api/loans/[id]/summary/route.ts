import { NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api/error-handler";
import { getLoanSummary } from "@/lib/services";

export const GET = withErrorHandler(async (req, context) => {
  const params = await context!.params;
  const summary = await getLoanSummary(params.id);
  return NextResponse.json(summary);
});
