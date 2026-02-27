import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth-middleware";
import { getDashboardMetrics } from "@/lib/services/reports.service";

export const dynamic = 'force-dynamic';

export const GET = withAuth(async () => {
  const metrics = await getDashboardMetrics();
  return NextResponse.json(metrics);
});
