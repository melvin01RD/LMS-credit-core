import { LoanStatus, PaymentFrequency, LoanStructure, ScheduleStatus, PaymentType } from "@prisma/client";

// ============================================
// TEST DATA FACTORIES
// Shared across all test files
// ============================================

export const createMockLoan = (overrides = {}) => ({
  id: "loan-1",
  clientId: "client-1",
  loanStructure: LoanStructure.FLAT_RATE,
  principalAmount: 10000,
  annualInterestRate: null,
  totalFinanceCharge: 2000,
  totalPayableAmount: 12000,
  paymentFrequency: PaymentFrequency.WEEKLY,
  termCount: 8,
  installmentAmount: 1500,
  remainingCapital: 12000,
  installmentsPaid: 0,
  nextDueDate: new Date(Date.now() + 7 * 86400000),
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
  installmentsCovered: 1,
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

export const createMockFlatRateLoan = (overrides = {}) => ({
  id: "loan-flat-1",
  clientId: "client-1",
  loanStructure: LoanStructure.FLAT_RATE,
  principalAmount: 10000,
  annualInterestRate: null,
  totalFinanceCharge: 3500,
  totalPayableAmount: 13500,
  paymentFrequency: PaymentFrequency.DAILY,
  termCount: 45,
  installmentAmount: 300,
  remainingCapital: 13500,
  installmentsPaid: 0,
  nextDueDate: new Date(Date.now() + 86400000),
  status: LoanStatus.ACTIVE,
  guarantees: null,
  createdById: "user-1",
  updatedById: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockFlatRateWeeklyLoan = (overrides = {}) => ({
  id: "loan-flat-weekly-1",
  clientId: "client-1",
  loanStructure: LoanStructure.FLAT_RATE,
  principalAmount: 10000,
  annualInterestRate: null,
  totalFinanceCharge: 2000,
  totalPayableAmount: 12000,
  paymentFrequency: PaymentFrequency.WEEKLY,
  termCount: 8,
  installmentAmount: 1500,
  remainingCapital: 12000,
  installmentsPaid: 0,
  nextDueDate: new Date(Date.now() + 7 * 86400000),
  status: LoanStatus.ACTIVE,
  guarantees: null,
  createdById: "user-1",
  updatedById: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockScheduleEntry = (overrides = {}) => ({
  id: "schedule-1",
  loanId: "loan-flat-1",
  installmentNumber: 1,
  dueDate: new Date(Date.now() + 86400000),
  expectedAmount: 300,
  principalExpected: 222.22,
  interestExpected: 77.78,
  status: ScheduleStatus.PENDING,
  paidAt: null,
  paymentId: null,
  ...overrides,
});

export const createMockSchedule = (
  loanId: string,
  count: number,
  installmentAmount: number,
  startDate: Date = new Date(),
  paidCount: number = 0
) =>
  Array.from({ length: count }, (_, i) => ({
    id: `schedule-${i + 1}`,
    loanId,
    installmentNumber: i + 1,
    dueDate: new Date(startDate.getTime() + (i + 1) * 86400000),
    expectedAmount: installmentAmount,
    principalExpected: Math.round(installmentAmount * 0.74 * 100) / 100,
    interestExpected: Math.round(installmentAmount * 0.26 * 100) / 100,
    status: i < paidCount ? ScheduleStatus.PAID : ScheduleStatus.PENDING,
    paidAt: i < paidCount ? new Date() : null,
    paymentId: i < paidCount ? `payment-${i + 1}` : null,
  }));

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
