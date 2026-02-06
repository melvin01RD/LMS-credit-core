import { NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api/error-handler";
import { getLoans } from "@/lib/services";

export const GET = withErrorHandler(async (req, context) => {
  const params = await context!.params;
  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get("page") ?? 1);
  const limit = Number(searchParams.get("limit") ?? 20);

  const result = await getLoans(
    { clientId: params.id },
    { page, limit }
  );

  return NextResponse.json(result);
});
