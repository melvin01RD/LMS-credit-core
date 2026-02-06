import { NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api/error-handler";
import { destroySession } from "@/lib/auth";

export const POST = withErrorHandler(async () => {
  await destroySession();

  return NextResponse.json({
    message: "Sesión cerrada exitosamente",
  });
});
