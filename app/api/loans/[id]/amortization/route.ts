import { NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api/error-handler";
import { getLoanAmortization } from "@/lib/services";

export const GET = withErrorHandler(async (req, context) => {
  const params = await context!.params;
  const schedule = await getLoanAmortization(params.id);
  return NextResponse.json(schedule);
});
