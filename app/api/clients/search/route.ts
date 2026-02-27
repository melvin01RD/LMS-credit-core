import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth-middleware";
import { searchClients } from "@/lib/services";

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const limit = Number(searchParams.get("limit") ?? 10);

  const results = await searchClients(q, limit);
  return NextResponse.json(results);
});
