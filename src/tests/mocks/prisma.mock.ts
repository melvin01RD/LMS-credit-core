import { vi } from "vitest";

export const prismaMock = {
  loan: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  payment: {
    create: vi.fn(),
  },
};
