import { vi } from "vitest";

// Mock del módulo prisma - compartido entre todos los test files de servicios
vi.mock("../../../lib/db/prisma", async () => {
  const { prismaMock } = await import("./prisma.mock");
  return { prisma: prismaMock };
});
