import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth-middleware";
import { reversePayment } from "@/lib/services";

export const POST = withAuth(async (req, context) => {
  const params = await context!.params;
  const { reversedById, reason } = await req.json();

  if (!reversedById) {
    return NextResponse.json(
      { error: { code: "MISSING_USER_ID", message: "reversedById es requerido" } },
      { status: 400 }
    );
  }

  const result = await reversePayment(params.id, reversedById, reason ?? "Sin razón especificada");
  return NextResponse.json(result);
});
