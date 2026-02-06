import { NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api/error-handler";
import { getClientById, updateClient, deactivateClient } from "@/lib/services";

export const GET = withErrorHandler(async (req, context) => {
  const params = await context!.params;
  const client = await getClientById(params.id);
  return NextResponse.json(client);
});

export const PUT = withErrorHandler(async (req, context) => {
  const params = await context!.params;
  const data = await req.json();
  const client = await updateClient(params.id, data);
  return NextResponse.json(client);
});

export const DELETE = withErrorHandler(async (req, context) => {
  const params = await context!.params;
  const client = await deactivateClient(params.id);
  return NextResponse.json(client);
});
