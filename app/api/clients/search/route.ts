import { NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api/error-handler";
import { searchClients } from "@/lib/services";

export const GET = withErrorHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const limit = Number(searchParams.get("limit") ?? 10);

  const results = await searchClients(q, limit);
  return NextResponse.json(results);
});
