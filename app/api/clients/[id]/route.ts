import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth-middleware";
import { getClientById, updateClient, deactivateClient, auditLog, AuditAction, AuditEntity } from "@/lib/services";

export const GET = withAuth(async (req, context) => {
  const params = await context!.params;
  const client = await getClientById(params.id);
  return NextResponse.json(client);
});

export const PUT = withAuth(async (req, context) => {
  const params = await context!.params;
  const data = await req.json();
  const client = await updateClient(params.id, data);
  await auditLog(req.session.userId, AuditAction.UPDATE_CLIENT, AuditEntity.CLIENT, params.id, {
    updatedFields: Object.keys(data),
  });
  return NextResponse.json(client);
});

export const DELETE = withAuth(async (req, context) => {
  const params = await context!.params;
  const client = await deactivateClient(params.id);
  await auditLog(req.session.userId, AuditAction.DELETE_CLIENT, AuditEntity.CLIENT, params.id);
  return NextResponse.json(client);
});
