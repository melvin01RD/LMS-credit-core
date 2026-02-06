import { NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api/error-handler";
import { getUserById, updateUser, deactivateUser } from "@/lib/services";

export const GET = withErrorHandler(async (req, context) => {
  const params = await context!.params;
  const user = await getUserById(params.id);
  return NextResponse.json(user);
});

export const PUT = withErrorHandler(async (req, context) => {
  const params = await context!.params;
  const data = await req.json();
  const user = await updateUser(params.id, data);
  return NextResponse.json(user);
});

export const DELETE = withErrorHandler(async (req, context) => {
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
