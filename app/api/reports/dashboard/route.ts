import { NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api/error-handler";
import { getDashboardMetrics } from "@/lib/services/reports.service";

export const GET = withErrorHandler(async () => {
  const metrics = await getDashboardMetrics();
  return NextResponse.json(metrics);
});
