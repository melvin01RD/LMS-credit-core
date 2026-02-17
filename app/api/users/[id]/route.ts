import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth-middleware";
import { getUserById, updateUser, deactivateUser } from "@/lib/services";

export const GET = withAuth(async (req, context) => {
  const params = await context!.params;
  const user = await getUserById(params.id);
  return NextResponse.json(user);
});

export const PUT = withAuth(async (req, context) => {
  const params = await context!.params;
  const data = await req.json();
  const user = await updateUser(params.id, data);
  return NextResponse.json(user);
});

export const DELETE = withAuth(async (req, context) => {
  const params = await context!.params;
  const { deactivatedById } = await req.json();

  if (!deactivatedById) {
    return NextResponse.json(
      { error: { code: "MISSING_USER_ID", message: "deactivatedById es requerido" } },
      { status: 400 }
    );
  }

  const user = await deactivateUser(params.id, deactivatedById);
  return NextResponse.json(user);
});
