import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth-middleware";
import { cancelLoan } from "@/lib/services";

/**
 * POST /api/loans/[id]/cancel
 * Cancela un préstamo (alternativa a DELETE /api/loans/[id])
 * Útil para frontends que prefieren POST para acciones de negocio
 *
 * Body (JSON):
 *  - userId (string) → ID del usuario que realiza la cancelación
 */
export const POST = withAuth(async (req, context) => {
  const params = await context!.params;
  const { userId } = await req.json();

  if (!userId) {
    return NextResponse.json(
      { error: "Se requiere el userId del operador que cancela el préstamo" },
      { status: 400 }
    );
  }

  const loan = await cancelLoan(params.id, userId);

  return NextResponse.json({
    message: "Préstamo cancelado exitosamente",
    loan,
  });
});
