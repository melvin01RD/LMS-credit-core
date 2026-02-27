import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth-middleware";
import { createClient, getClients, auditLog, AuditAction, AuditEntity } from "@/lib/services";

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req) => {
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

export const POST = withAuth(async (req) => {
  const data = await req.json();
  const client = await createClient(data);
  await auditLog(req.session.userId, AuditAction.CREATE_CLIENT, AuditEntity.CLIENT, client.id, {
    firstName: client.firstName,
    currency: client.currency,
  });
  return NextResponse.json(client, { status: 201 });
});
