import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createLoan,
  getLoanById,
  getLoans,
  cancelLoan,
  markLoanAsOverdue,
  getLoanPayments,
  getLoanSummary,
} from "../../lib/services/loan.service";
import { createPayment } from "../../lib/services/payment.service";
import {
  LoanNotFoundError,
  PaymentNotAllowedError,
  InvalidPaymentAmountError,
} from "../../lib/errors";
import { canApplyPayment, applyPayment } from "../../lib/domain/loan";
import { LoanStatus, PaymentFrequency, PaymentType } from "@prisma/client";
import { prismaMock } from "./mocks/prisma.mock";

// Mock del módulo prisma
vi.mock("../../lib/db/prisma", async () => {
  const { prismaMock } = await import("./mocks/prisma.mock");
  return { prisma: prismaMock };
});

vi.mock("@/lib/db/prisma", async () => {
  const { prismaMock } = await import("./mocks/prisma.mock");
  return { prisma: prismaMock };
});

// ============================================
// TEST DATA FACTORIES
// ============================================

const createMockLoan = (overrides = {}) => ({
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

const createMockPayment = (overrides = {}) => ({
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

const createMockClient = (overrides = {}) => ({
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

// ============================================
// TESTS: createLoan
// ============================================

describe("Loan Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createLoan", () => {
    it("should create a loan with ACTIVE status", async () => {
      const mockLoan = createMockLoan();
      prismaMock.loan.create.mockResolvedValue(mockLoan);

      const result = await createLoan({
        clientId: "client-1",
        principalAmount: 10000,
        annualInterestRate: 24,
        termCount: 12,
        paymentFrequency: PaymentFrequency.MONTHLY,
        createdById: "user-1",
      });

      expect(prismaMock.loan.create).toHaveBeenCalledOnce();
      expect(result.status).toBe(LoanStatus.ACTIVE);
    });

    it("should calculate installment amount using French amortization", async () => {
      const mockLoan = createMockLoan({ installmentAmount: 942.52 });
      prismaMock.loan.create.mockResolvedValue(mockLoan);

      await createLoan({
        clientId: "client-1",
        principalAmount: 10000,
        annualInterestRate: 24,
        termCount: 12,
        paymentFrequency: PaymentFrequency.MONTHLY,
        createdById: "user-1",
      });

      const callArgs = prismaMock.loan.create.mock.calls[0][0];
      // Using French amortization, the installment should include interest
      expect(callArgs.data.installmentAmount).toBeGreaterThan(10000 / 12);
    });

    it("should set nextDueDate based on payment frequency", async () => {
      const mockLoan = createMockLoan();
      prismaMock.loan.create.mockResolvedValue(mockLoan);

      await createLoan({
        clientId: "client-1",
        principalAmount: 10000,
        annualInterestRate: 24,
        termCount: 12,
        paymentFrequency: PaymentFrequency.MONTHLY,
        createdById: "user-1",
      });

      const callArgs = prismaMock.loan.create.mock.calls[0][0];
      expect(callArgs.data.nextDueDate).toBeInstanceOf(Date);
    });
  });

  // ============================================
  // TESTS: createPayment (moved to payment.service)
  // ============================================

  describe("createPayment", () => {
    it("should register a payment and update loan balance", async () => {
      const mockLoan = createMockLoan({ remainingCapital: 10000 });
      const mockPayment = createMockPayment();
      const updatedLoan = createMockLoan({ remainingCapital: 9200, status: LoanStatus.ACTIVE });

      prismaMock.$transaction.mockImplementation(async (callback) => {
        const txMock = {
          loan: {
            findUnique: vi.fn().mockResolvedValue(mockLoan),
            update: vi.fn().mockResolvedValue(updatedLoan),
          },
          payment: {
            create: vi.fn().mockResolvedValue(mockPayment),
          },
        };
        return callback(txMock);
      });

      const result = await createPayment({
        loanId: "loan-1",
        totalAmount: 1000,
        capitalApplied: 800,
        interestApplied: 200,
        type: PaymentType.REGULAR,
        createdById: "user-1",
      });

      expect(result.payment).toBeDefined();
      expect(result.loan).toBeDefined();
      expect(result.previousBalance).toBe(10000);
    });

    it("should mark loan as PAID when balance reaches zero", async () => {
      const mockLoan = createMockLoan({ remainingCapital: 800 });
      const mockPayment = createMockPayment({ capitalApplied: 800 });
      const updatedLoan = createMockLoan({ remainingCapital: 0, status: LoanStatus.PAID });

      prismaMock.$transaction.mockImplementation(async (callback) => {
        const txMock = {
          loan: {
            findUnique: vi.fn().mockResolvedValue(mockLoan),
            update: vi.fn().mockResolvedValue(updatedLoan),
          },
          payment: {
            create: vi.fn().mockResolvedValue(mockPayment),
          },
        };
        return callback(txMock);
      });

      const result = await createPayment({
        loanId: "loan-1",
        totalAmount: 1000,
        capitalApplied: 800,
        interestApplied: 200,
        type: PaymentType.FULL_SETTLEMENT,
        createdById: "user-1",
      });

      expect(result.statusChanged).toBe(true);
    });

    it("should throw LoanNotFoundError when loan does not exist", async () => {
      prismaMock.$transaction.mockImplementation(async (callback) => {
        const txMock = {
          loan: {
            findUnique: vi.fn().mockResolvedValue(null),
          },
        };
        return callback(txMock);
      });

      await expect(
        createPayment({
          loanId: "non-existent",
          totalAmount: 1000,
          capitalApplied: 800,
          interestApplied: 200,
          type: PaymentType.REGULAR,
          createdById: "user-1",
        })
      ).rejects.toThrow(LoanNotFoundError);
    });

    it("should throw PaymentNotAllowedError for PAID loans", async () => {
      const paidLoan = createMockLoan({ status: LoanStatus.PAID, remainingCapital: 0 });

      prismaMock.$transaction.mockImplementation(async (callback) => {
        const txMock = {
          loan: {
            findUnique: vi.fn().mockResolvedValue(paidLoan),
          },
        };
        return callback(txMock);
      });

      await expect(
        createPayment({
          loanId: "loan-1",
          totalAmount: 1000,
          capitalApplied: 800,
          interestApplied: 200,
          type: PaymentType.REGULAR,
          createdById: "user-1",
        })
      ).rejects.toThrow(PaymentNotAllowedError);
    });

    it("should throw InvalidPaymentAmountError for zero amount", async () => {
      await expect(
        createPayment({
          loanId: "loan-1",
          totalAmount: 0,
          capitalApplied: 0,
          interestApplied: 0,
          type: PaymentType.REGULAR,
          createdById: "user-1",
        })
      ).rejects.toThrow(InvalidPaymentAmountError);
    });

    it("should throw InvalidPaymentAmountError when parts do not match total", async () => {
      await expect(
        createPayment({
          loanId: "loan-1",
          totalAmount: 1000,
          capitalApplied: 500,
          interestApplied: 100,
          type: PaymentType.REGULAR,
          createdById: "user-1",
        })
      ).rejects.toThrow(InvalidPaymentAmountError);
    });

    it("should allow payment on OVERDUE loan", async () => {
      const overdueLoan = createMockLoan({ status: LoanStatus.OVERDUE, remainingCapital: 5000 });
      const mockPayment = createMockPayment();
      const updatedLoan = createMockLoan({ remainingCapital: 4200, status: LoanStatus.ACTIVE });

      prismaMock.$transaction.mockImplementation(async (callback) => {
        const txMock = {
          loan: {
            findUnique: vi.fn().mockResolvedValue(overdueLoan),
            update: vi.fn().mockResolvedValue(updatedLoan),
          },
          payment: {
            create: vi.fn().mockResolvedValue(mockPayment),
          },
        };
        return callback(txMock);
      });

      const result = await createPayment({
        loanId: "loan-1",
        totalAmount: 1000,
        capitalApplied: 800,
        interestApplied: 200,
        type: PaymentType.REGULAR,
        createdById: "user-1",
      });

      expect(result.payment).toBeDefined();
    });

    it("should include late fee in payment", async () => {
      const mockLoan = createMockLoan({ remainingCapital: 10000 });
      const mockPayment = createMockPayment({
        totalAmount: 1100,
        capitalApplied: 800,
        interestApplied: 200,
        lateFeeApplied: 100,
      });
      const updatedLoan = createMockLoan({ remainingCapital: 9200 });

      prismaMock.$transaction.mockImplementation(async (callback) => {
        const txMock = {
          loan: {
            findUnique: vi.fn().mockResolvedValue(mockLoan),
            update: vi.fn().mockResolvedValue(updatedLoan),
          },
          payment: {
            create: vi.fn().mockResolvedValue(mockPayment),
          },
        };
        return callback(txMock);
      });

      const result = await createPayment({
        loanId: "loan-1",
        totalAmount: 1100,
        capitalApplied: 800,
        interestApplied: 200,
        lateFeeApplied: 100,
        type: PaymentType.REGULAR,
        createdById: "user-1",
      });

      expect(result.payment.lateFeeApplied).toBe(100);
    });
  });

  // ============================================
  // TESTS: getLoanById
  // ============================================

  describe("getLoanById", () => {
    it("should return loan with relations", async () => {
      const mockLoan = {
        ...createMockLoan(),
        client: createMockClient(),
        payments: [],
        createdBy: { id: "user-1", firstName: "Admin", lastName: "User", email: "admin@test.com" },
        updatedBy: null,
      };

      prismaMock.loan.findUnique.mockResolvedValue(mockLoan);

      const result = await getLoanById("loan-1");

      expect(result.client).toBeDefined();
      expect(result.payments).toBeDefined();
    });

    it("should throw LoanNotFoundError when not found", async () => {
      prismaMock.loan.findUnique.mockResolvedValue(null);

      await expect(getLoanById("non-existent")).rejects.toThrow(LoanNotFoundError);
    });
  });

  // ============================================
  // TESTS: getLoans
  // ============================================

  describe("getLoans", () => {
    it("should return all loans without filters", async () => {
      const mockLoans = [createMockLoan(), createMockLoan({ id: "loan-2" })];
      prismaMock.loan.findMany.mockResolvedValue(mockLoans);
      prismaMock.loan.count.mockResolvedValue(2);

      const result = await getLoans();

      expect(result.data).toHaveLength(2);
    });

    it("should filter by clientId", async () => {
      prismaMock.loan.findMany.mockResolvedValue([createMockLoan()]);
      prismaMock.loan.count.mockResolvedValue(1);

      await getLoans({ clientId: "client-1" });

      expect(prismaMock.loan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ clientId: "client-1" }),
        })
      );
    });

    it("should filter by status", async () => {
      prismaMock.loan.findMany.mockResolvedValue([]);
      prismaMock.loan.count.mockResolvedValue(0);

      await getLoans({ status: LoanStatus.OVERDUE });

      expect(prismaMock.loan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: LoanStatus.OVERDUE }),
        })
      );
    });

    it("should combine multiple filters", async () => {
      prismaMock.loan.findMany.mockResolvedValue([]);
      prismaMock.loan.count.mockResolvedValue(0);

      await getLoans({ clientId: "client-1", status: LoanStatus.ACTIVE });

      expect(prismaMock.loan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ clientId: "client-1", status: LoanStatus.ACTIVE }),
        })
      );
    });
  });

  // ============================================
  // TESTS: cancelLoan
  // ============================================

  describe("cancelLoan", () => {
    it("should cancel an ACTIVE loan", async () => {
      const mockLoan = createMockLoan({ status: LoanStatus.ACTIVE });
      const canceledLoan = createMockLoan({ status: LoanStatus.CANCELED });

      prismaMock.loan.findUnique.mockResolvedValue(mockLoan);
      prismaMock.loan.update.mockResolvedValue(canceledLoan);

      const result = await cancelLoan("loan-1", "user-1");

      expect(result.status).toBe(LoanStatus.CANCELED);
    });

    it("should throw error when canceling PAID loan", async () => {
      const paidLoan = createMockLoan({ status: LoanStatus.PAID });
      prismaMock.loan.findUnique.mockResolvedValue(paidLoan);

      await expect(cancelLoan("loan-1", "user-1")).rejects.toThrow(PaymentNotAllowedError);
    });

    it("should throw error when loan already CANCELED", async () => {
      const canceledLoan = createMockLoan({ status: LoanStatus.CANCELED });
      prismaMock.loan.findUnique.mockResolvedValue(canceledLoan);

      await expect(cancelLoan("loan-1", "user-1")).rejects.toThrow(
        "El préstamo ya está cancelado"
      );
    });

    it("should throw LoanNotFoundError when not found", async () => {
      prismaMock.loan.findUnique.mockResolvedValue(null);

      await expect(cancelLoan("non-existent", "user-1")).rejects.toThrow(LoanNotFoundError);
    });
  });

  // ============================================
  // TESTS: markLoanAsOverdue
  // ============================================

  describe("markLoanAsOverdue", () => {
    it("should mark ACTIVE loan as OVERDUE", async () => {
      const activeLoan = createMockLoan({ status: LoanStatus.ACTIVE });
      const overdueLoan = createMockLoan({ status: LoanStatus.OVERDUE });

      prismaMock.loan.findUnique.mockResolvedValue(activeLoan);
      prismaMock.loan.update.mockResolvedValue(overdueLoan);

      const result = await markLoanAsOverdue("loan-1", "user-1");

      expect(result.status).toBe(LoanStatus.OVERDUE);
    });

    it("should throw error for non-ACTIVE loans", async () => {
      const paidLoan = createMockLoan({ status: LoanStatus.PAID });
      prismaMock.loan.findUnique.mockResolvedValue(paidLoan);

      await expect(markLoanAsOverdue("loan-1", "user-1")).rejects.toThrow(
        "Solo préstamos ACTIVE pueden marcarse como OVERDUE"
      );
    });
  });

  // ============================================
  // TESTS: getLoanPayments
  // ============================================

  describe("getLoanPayments", () => {
    it("should return payments for a loan", async () => {
      const mockPayments = [
        createMockPayment(),
        createMockPayment({ id: "payment-2" }),
      ];

      prismaMock.loan.findUnique.mockResolvedValue(createMockLoan());
      prismaMock.payment.findMany.mockResolvedValue(mockPayments);

      const result = await getLoanPayments("loan-1");

      expect(result).toHaveLength(2);
    });

    it("should throw LoanNotFoundError when loan not found", async () => {
      prismaMock.loan.findUnique.mockResolvedValue(null);

      await expect(getLoanPayments("non-existent")).rejects.toThrow(LoanNotFoundError);
    });
  });

  // ============================================
  // TESTS: getLoanSummary
  // ============================================

  describe("getLoanSummary", () => {
    it("should return loan summary with calculations", async () => {
      const mockLoan = {
        ...createMockLoan({ principalAmount: 10000, remainingCapital: 8000 }),
        client: createMockClient(),
        payments: [],
        createdBy: { id: "user-1", firstName: "Admin", lastName: "User", email: "admin@test.com" },
        updatedBy: null,
      };

      prismaMock.loan.findUnique.mockResolvedValue(mockLoan);
      prismaMock.payment.aggregate.mockResolvedValue({
        _sum: {
          totalAmount: 2500,
          capitalApplied: 2000,
          interestApplied: 500,
          lateFeeApplied: 0,
        },
        _count: 3,
      });

      const result = await getLoanSummary("loan-1");

      expect(result.summary.principalAmount).toBe(10000);
      expect(result.summary.remainingCapital).toBe(8000);
      expect(result.summary.capitalPaid).toBe(2000);
      expect(result.summary.paymentCount).toBe(3);
      expect(result.summary.progressPercentage).toBe(20);
    });
  });
});

// ============================================
// TESTS: Loan Domain Logic (canApplyPayment, applyPayment)
// ============================================
describe("Loan Domain Logic", () => {
  describe("canApplyPayment", () => {
    it("should return true for ACTIVE loans", () => {
      expect(canApplyPayment(LoanStatus.ACTIVE)).toBe(true);
    });

    it("should return true for OVERDUE loans", () => {
      expect(canApplyPayment(LoanStatus.OVERDUE)).toBe(true);
    });

    it("should return false for CANCELED loans", () => {
      // Updated: CANCELED loans should not accept payments
      expect(canApplyPayment(LoanStatus.CANCELED)).toBe(false);
    });

    it("should return false for PAID loans", () => {
      expect(canApplyPayment(LoanStatus.PAID)).toBe(false);
    });
  });

  describe("applyPayment", () => {
    it("should reduce balance by payment amount", () => {
      const result = applyPayment(1000, 200);

      expect(result.balance).toBe(800);
      expect(result.status).toBe(LoanStatus.ACTIVE);
    });

    it("should mark loan as PAID when balance reaches zero", () => {
      const result = applyPayment(500, 500);

      expect(result.balance).toBe(0);
      expect(result.status).toBe(LoanStatus.PAID);
    });

    it("should mark loan as PAID when payment exceeds balance", () => {
      const result = applyPayment(300, 500);

      expect(result.balance).toBe(0);
      expect(result.status).toBe(LoanStatus.PAID);
    });

    it("should keep status ACTIVE when balance remains", () => {
      const result = applyPayment(10000, 1000);

      expect(result.balance).toBe(9000);
      expect(result.status).toBe(LoanStatus.ACTIVE);
    });

    it("should throw error for zero payment amount", () => {
      expect(() => applyPayment(1000, 0)).toThrow(
        "Monto del pago debe ser mas grande que cero"
      );
    });

    it("should throw error for negative payment amount", () => {
      expect(() => applyPayment(1000, -100)).toThrow(
        "Monto del pago debe ser mas grande que cero"
      );
    });
  });
});

// ============================================
// TESTS: Edge Cases and Error Handling
// ============================================

describe("Edge Cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should handle decimal precision in payments", async () => {
    const mockLoan = createMockLoan({ remainingCapital: 1000.50 });
    const mockPayment = createMockPayment({
      totalAmount: 100.25,
      capitalApplied: 80.15,
      interestApplied: 20.10,
    });
    const updatedLoan = createMockLoan({ remainingCapital: 920.35 });

    prismaMock.$transaction.mockImplementation(async (callback) => {
      const txMock = {
        loan: {
          findUnique: vi.fn().mockResolvedValue(mockLoan),
          update: vi.fn().mockResolvedValue(updatedLoan),
        },
        payment: {
          create: vi.fn().mockResolvedValue(mockPayment),
        },
      };
      return callback(txMock);
    });

    const result = await createPayment({
      loanId: "loan-1",
      totalAmount: 100.25,
      capitalApplied: 80.15,
      interestApplied: 20.10,
      type: PaymentType.REGULAR,
      createdById: "user-1",
    });

    expect(result.payment).toBeDefined();
  });

  it("should handle capital-only payments", async () => {
    const mockLoan = createMockLoan({ remainingCapital: 5000 });
    const mockPayment = createMockPayment({
      totalAmount: 1000,
      capitalApplied: 1000,
      interestApplied: 0,
      type: PaymentType.CAPITAL_PAYMENT,
    });
    const updatedLoan = createMockLoan({ remainingCapital: 4000 });

    prismaMock.$transaction.mockImplementation(async (callback) => {
      const txMock = {
        loan: {
          findUnique: vi.fn().mockResolvedValue(mockLoan),
          update: vi.fn().mockResolvedValue(updatedLoan),
        },
        payment: {
          create: vi.fn().mockResolvedValue(mockPayment),
        },
      };
      return callback(txMock);
    });

    const result = await createPayment({
      loanId: "loan-1",
      totalAmount: 1000,
      capitalApplied: 1000,
      interestApplied: 0,
      type: PaymentType.CAPITAL_PAYMENT,
      createdById: "user-1",
    });

    expect(result.payment.type).toBe(PaymentType.CAPITAL_PAYMENT);
  });

  it("should handle very small payments", () => {
    const result = applyPayment(1000, 0.01);

    expect(result.balance).toBe(999.99);
    expect(result.status).toBe(LoanStatus.ACTIVE);
  });

  it("should handle large loan amounts", () => {
    const largeAmount = 1000000000;
    const payment = 1000000;

    const result = applyPayment(largeAmount, payment);

    expect(result.balance).toBe(999000000);
    expect(result.status).toBe(LoanStatus.ACTIVE);
  });

  it("should handle decimal precision in domain logic", () => {
    const result = applyPayment(100.50, 50.25);

    expect(result.balance).toBeCloseTo(50.25, 2);
    expect(result.status).toBe(LoanStatus.ACTIVE);
  });
});
