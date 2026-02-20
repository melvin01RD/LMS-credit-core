import { prisma } from "../db/prisma";
import { LateFeeType } from "@prisma/client";
import { z } from "zod";

// ============================================
// ZOD SCHEMA — exportado para reuso en la API route
// ============================================

export const updateConfigSchema = z.object({
  businessName: z.string().min(1, "El nombre del negocio es requerido"),
  rnc: z.string().nullish(),
  address: z.string().nullish(),
  phone: z.string().nullish(),
  email: z.string().email("Email inválido").nullish().or(z.literal("")),
  lateFeeType: z.nativeEnum(LateFeeType),
  lateFeeValue: z.number().min(0, "El valor debe ser mayor o igual a 0"),
  gracePeriodDays: z
    .number()
    .int("Debe ser un número entero")
    .min(0, "Los días de gracia deben ser 0 o más"),
  defaultMonthlyRate: z.number().min(0).nullish(),
  defaultWeeklyRate: z.number().min(0).nullish(),
  defaultDailyRate: z.number().min(0).nullish(),
});

// ============================================
// TIPOS
// ============================================

export type SystemConfigData = z.infer<typeof updateConfigSchema>;

// ============================================
// OPERACIONES
// ============================================

/**
 * Obtiene la configuración del sistema (singleton id="singleton").
 * Si no existe lo crea con valores por defecto.
 */
export async function getConfig() {
  return prisma.systemConfig.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
}

/**
 * Actualiza la configuración del sistema.
 * Valida con Zod antes de persistir.
 * @param data  Datos a actualizar (validados por updateConfigSchema)
 * @param userId  ID del usuario que realizó el cambio
 */
export async function updateConfig(data: unknown, userId: string) {
  const validated = updateConfigSchema.parse(data);

  return prisma.systemConfig.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      ...validated,
      lateFeeValue: validated.lateFeeValue,
      updatedById: userId,
    },
    update: {
      ...validated,
      lateFeeValue: validated.lateFeeValue,
      updatedById: userId,
    },
  });
}
