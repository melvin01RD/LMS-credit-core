import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth-middleware";
import { changePassword, resetPassword } from "@/lib/services";

export const PUT = withAuth(async (req, context) => {
  const params = await context!.params;
  const { currentPassword, newPassword, resetById } = await req.json();

  // Si viene resetById, es un reset administrativo
  if (resetById) {
    await resetPassword({
      userId: params.id,
      newPassword,
      resetById,
    });
    return NextResponse.json({ message: "Contraseña restablecida exitosamente" });
  }

  // Si no, es un cambio de contraseña normal
  if (!currentPassword) {
    return NextResponse.json(
      { error: { code: "MISSING_CURRENT_PASSWORD", message: "currentPassword es requerido" } },
      { status: 400 }
    );
  }

  await changePassword({
    userId: params.id,
    currentPassword,
    newPassword,
  });

  return NextResponse.json({ message: "Contraseña cambiada exitosamente" });
});
