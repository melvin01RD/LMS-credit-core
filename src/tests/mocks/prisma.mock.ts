import { vi } from "vitest";

export const prismaMock = {
  // Loan operations
  loan: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  
  // Payment operations
  payment: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    aggregate: vi.fn(),
  },
  
  // Client operations
  client: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  
  // User operations
  user: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  
  // Transaction support
  $transaction: vi.fn(),
};

// Type for better intellisense
export type PrismaMock = typeof prismaMock;
