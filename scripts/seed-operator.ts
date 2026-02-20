/**
 * Script temporal para crear el usuario OPERATOR de prueba.
 * Ejecutar con: npx ts-node --project tsconfig.json scripts/seed-operator.ts
 *
 * NOTA: Este script es de uso único para crear el usuario inicial.
 * No hardcodear credenciales en código de producción.
 */

import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "operador.prueba@lmscredit.com";

  // Verificar si ya existe
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Usuario ya existe: ${email} (id: ${existing.id})`);
    return;
  }

  const passwordHash = await bcrypt.hash("Operador2024!", 10);

  const user = await prisma.user.create({
    data: {
      email,
      password: passwordHash,
      firstName: "Operador",
      lastName: "Prueba",
      role: UserRole.OPERATOR,
      active: true,
    },
  });

  console.log(`✅ Usuario OPERATOR creado exitosamente:`);
  console.log(`   id:    ${user.id}`);
  console.log(`   email: ${user.email}`);
  console.log(`   role:  ${user.role}`);
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
