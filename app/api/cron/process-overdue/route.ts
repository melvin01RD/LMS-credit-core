import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { processOverdueLoans } from "@/lib/services";

export const dynamic = 'force-dynamic';

/**
 * Cron Job — Proceso de mora automática
 *
 * processOverdueLoans ya hace exactamente lo necesario:
 *   1. Marca PaymentSchedule.status → OVERDUE (cuotas con dueDate < hoy)
 *   2. Marca Loan.status → OVERDUE (loans ACTIVE con nextDueDate < hoy)
 *   3. Retorna { affected: number }
 *
 * Vercel llama este endpoint vía GET con el header:
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Schedule en vercel.json: "0 6 * * *" → todos los días a las 6:00 AM UTC
 * (equivale a 2:00 AM hora dominicana)
 */
export async function GET(req: NextRequest) {
  // 1. Verificar el secret — solo Vercel puede llamar esto
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[CRON] CRON_SECRET no está definido en variables de entorno");
    return NextResponse.json(
      { error: "Configuración incorrecta del servidor" },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // 2. Obtener userId del sistema (primer usuario ADMIN)
  const systemUser = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });

  if (!systemUser) {
    console.error("[CRON] No se encontró usuario ADMIN en la base de datos");
    return NextResponse.json(
      { error: "No se encontró usuario del sistema" },
      { status: 500 }
    );
  }

  // 3. Ejecutar el proceso de mora
  const startTime = Date.now();
  console.log(
    `[CRON] Iniciando proceso de mora automática - ${new Date().toISOString()}`
  );

  const result = await processOverdueLoans(systemUser.id);

  const duration = Date.now() - startTime;
  console.log(
    `[CRON] Proceso completado en ${duration}ms — ${result.affected} préstamos marcados como OVERDUE`
  );

  // 4. Respuesta con métricas para el log de Vercel
  return NextResponse.json({
    success: true,
    affected: result.affected,
    executedAt: new Date().toISOString(),
    durationMs: duration,
  });
}
