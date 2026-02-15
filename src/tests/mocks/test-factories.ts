import { LoanStatus, PaymentFrequency, PaymentType } from "@prisma/client";

// ============================================
// TEST DATA FACTORIES
// Shared across all test files
// ============================================

export const createMockLoan = (overrides = {}) => ({
  id: "loan-1",
  clientId: "client-1",
  principalAmount: 10000,
  annualInterestRate: 24,
  paymentFrequency: PaymentFrequency.MONTHLY,
  termCount: 12,
  installmentAmount: 833.33,
  remainingCapital: 10000,
  nextDueDate: new Date("2026-02-21"),
  status: LoanStatus.ACTIVE,
  guarantees: null,
  createdById: "user-1",
  updatedById: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockPayment = (overrides = {}) => ({
  id: "payment-1",
  loanId: "loan-1",
  paymentDate: new Date(),
  totalAmount: 1000,
  capitalApplied: 800,
  interestApplied: 200,
  lateFeeApplied: 0,
  type: PaymentType.REGULAR,
  createdById: "user-1",
  createdAt: new Date(),
  ...overrides,
});

export const createMockClient = (overrides = {}) => ({
  id: "client-1",
  firstName: "Juan",
  lastName: "Pérez",
  documentId: "001-1234567-8",
  phone: "809-555-1234",
  email: "juan@test.com",
  address: "Calle Principal #123",
  currency: "DOP",
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

/**
 * Helper para crear el mock de transacción con loan y payment
 * Reduce la repetición en tests de createPayment
 */
export const createTransactionMock = (
  loanData: ReturnType<typeof createMockLoan> | null,
  paymentData?: ReturnType<typeof createMockPayment>,
  updatedLoanData?: ReturnType<typeof createMockLoan>
) => {
  const { vi } = require("vitest");
  return {
    loan: {
      findUnique: vi.fn().mockResolvedValue(loanData),
      update: vi.fn().mockResolvedValue(updatedLoanData ?? loanData),
    },
    payment: {
      create: vi.fn().mockResolvedValue(paymentData),
    },
  };
};
