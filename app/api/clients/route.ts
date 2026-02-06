import { NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api/error-handler";
import { createClient, getClients } from "@/lib/services";

export const GET = withErrorHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get("page") ?? 1);
  const limit = Number(searchParams.get("limit") ?? 20);
  const search = searchParams.get("search") ?? undefined;
  const active = searchParams.get("active");
  const currency = searchParams.get("currency") ?? undefined;

  const result = await getClients(
    {
      search,
      active: active !== null ? active === "true" : undefined,
      currency,
    },
    { page, limit }
  );

  return NextResponse.json(result);
});

export const POST = withErrorHandler(async (req) => {
  const data = await req.json();
  const client = await createClient(data);
  return NextResponse.json(client, { status: 201 });
});
