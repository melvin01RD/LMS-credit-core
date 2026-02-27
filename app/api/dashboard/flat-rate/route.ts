import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth-middleware";
import { getFlatRateMetrics } from "@/lib/services/reports.service";

export const dynamic = 'force-dynamic';

export const GET = withAuth(async () => {
  const metrics = await getFlatRateMetrics();
  return NextResponse.json(metrics);
});
