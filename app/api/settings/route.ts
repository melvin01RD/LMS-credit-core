import { NextResponse } from "next/server";
import { withRole } from "@/lib/api/role-middleware";
import { getConfig, updateConfig } from "@/lib/services";
import { UserRole } from "@prisma/client";

export const GET = withRole([UserRole.ADMIN], async () => {
  const config = await getConfig();
  return NextResponse.json(config);
});

export const PUT = withRole([UserRole.ADMIN], async (req) => {
  const body = await req.json();
  const config = await updateConfig(body, req.session.userId);
  return NextResponse.json(config);
});
