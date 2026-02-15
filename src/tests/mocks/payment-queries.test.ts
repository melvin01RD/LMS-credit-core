import { describe, it, expect, vi, beforeEach } from "vitest";
import "./setup";
import {
  getPaymentById,
  getPayments,
  getPaymentsByLoan,
  getPaymentsSummary,
  getTodayPayments,
} from "../../../lib/services/payment.service";
import { PaymentNotFoundError, LoanNotFoundError } from "../../../lib/errors";
import { PaymentType } from "@prisma/client";
import { prismaMock } from "./prisma.mock";
import { createMockLoan, createMockPayment, createMockClient } from "./test-factories";

// ============================================
// getPaymentById
// ============================================

describe("getPaymentById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return payment with loan and client relations", async () => {
    const mockPayment = {
      ...createMockPayment(),
      loan: { ...createMockLoan(), client: createMockClient() },
      createdBy: { id: "user-1", firstName: "Admin", lastName: "User", email: "admin@test.com" },
    };

    prismaMock.payment.findUnique.mockResolvedValue(mockPayment);

    const result = await getPaymentById("payment-1");

    expect(result.id).toBe("payment-1");
    expect(result.loan).toBeDefined();
    expect(result.createdBy).toBeDefined();
  });

  it("should throw PaymentNotFoundError when not found", async () => {
    prismaMock.payment.findUnique.mockResolvedValue(null);

    await expect(getPaymentById("non-existent")).rejects.toThrow(PaymentNotFoundError);
  });
});

// ============================================
// getPayments (paginated)
// ============================================

describe("getPayments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return paginated payments without filters", async () => {
    const mockPayments = [createMockPayment(), createMockPayment({ id: "payment-2" })];
    prismaMock.payment.findMany.mockResolvedValue(mockPayments);
    prismaMock.payment.count.mockResolvedValue(2);

    const result = await getPayments();

    expect(result.data).toHaveLength(2);
    expect(result.pagination.total).toBe(2);
    expect(result.pagination.page).toBe(1);
  });

  it("should filter by loanId", async () => {
    prismaMock.payment.findMany.mockResolvedValue([createMockPayment()]);
    prismaMock.payment.count.mockResolvedValue(1);

    await getPayments({ loanId: "loan-1" });

    const callArgs = prismaMock.payment.findMany.mock.calls[0][0];
    expect(callArgs.where.loanId).toBe("loan-1");
  });

  it("should filter by payment type", async () => {
    prismaMock.payment.findMany.mockResolvedValue([]);
    prismaMock.payment.count.mockResolvedValue(0);

    await getPayments({ type: PaymentType.CAPITAL_PAYMENT });

    const callArgs = prismaMock.payment.findMany.mock.calls[0][0];
    expect(callArgs.where.type).toBe(PaymentType.CAPITAL_PAYMENT);
  });

  it("should filter by date range", async () => {
    const dateFrom = new Date("2026-01-01");
    const dateTo = new Date("2026-01-31");

    prismaMock.payment.findMany.mockResolvedValue([]);
    prismaMock.payment.count.mockResolvedValue(0);

    await getPayments({ dateFrom, dateTo });

    const callArgs = prismaMock.payment.findMany.mock.calls[0][0];
    expect(callArgs.where.paymentDate.gte).toEqual(dateFrom);
    expect(callArgs.where.paymentDate.lte).toEqual(dateTo);
  });

  it("should handle custom pagination", async () => {
    prismaMock.payment.findMany.mockResolvedValue([]);
    prismaMock.payment.count.mockResolvedValue(100);

    const result = await getPayments({}, { page: 3, limit: 10 });

    expect(result.pagination.page).toBe(3);
    expect(result.pagination.totalPages).toBe(10);
    expect(result.pagination.hasNext).toBe(true);
    expect(result.pagination.hasPrev).toBe(true);
  });
});

// ============================================
// getPaymentsByLoan
// ============================================

describe("getPaymentsByLoan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return all payments for a loan", async () => {
    const mockPayments = [
      createMockPayment(),
      createMockPayment({ id: "payment-2" }),
      createMockPayment({ id: "payment-3" }),
    ];

    prismaMock.loan.findUnique.mockResolvedValue(createMockLoan());
    prismaMock.payment.findMany.mockResolvedValue(mockPayments);

    const result = await getPaymentsByLoan("loan-1");

    expect(result).toHaveLength(3);
  });

  it("should throw LoanNotFoundError when loan does not exist", async () => {
    prismaMock.loan.findUnique.mockResolvedValue(null);

    await expect(getPaymentsByLoan("non-existent")).rejects.toThrow(LoanNotFoundError);
  });
});

// ============================================
// getPaymentsSummary
// ============================================

describe("getPaymentsSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return aggregated payment summary", async () => {
    prismaMock.loan.findUnique.mockResolvedValue(
      createMockLoan({ principalAmount: 10000, remainingCapital: 7000 })
    );
    prismaMock.payment.aggregate.mockResolvedValue({
      _sum: {
        totalAmount: 3500,
        capitalApplied: 3000,
        interestApplied: 400,
        lateFeeApplied: 100,
      },
      _count: 4,
      _max: { paymentDate: new Date("2026-02-10") },
      _min: { paymentDate: new Date("2026-01-15") },
    });

    const result = await getPaymentsSummary("loan-1");

    expect(result.totalPayments).toBe(4);
    expect(result.totalPaid).toBe(3500);
    expect(result.totalCapitalPaid).toBe(3000);
    expect(result.totalInterestPaid).toBe(400);
    expect(result.totalLateFeesPaid).toBe(100);
    expect(result.progressPercentage).toBe(30); // (10000 - 7000) / 10000 * 100
    expect(result.firstPaymentDate).toBeDefined();
    expect(result.lastPaymentDate).toBeDefined();
  });

  it("should handle loan with no payments", async () => {
    prismaMock.loan.findUnique.mockResolvedValue(
      createMockLoan({ principalAmount: 10000, remainingCapital: 10000 })
    );
    prismaMock.payment.aggregate.mockResolvedValue({
      _sum: {
        totalAmount: null,
        capitalApplied: null,
        interestApplied: null,
        lateFeeApplied: null,
      },
      _count: 0,
      _max: { paymentDate: null },
      _min: { paymentDate: null },
    });

    const result = await getPaymentsSummary("loan-1");

    expect(result.totalPayments).toBe(0);
    expect(result.totalPaid).toBe(0);
    expect(result.progressPercentage).toBe(0);
  });

  it("should throw LoanNotFoundError when loan does not exist", async () => {
    prismaMock.loan.findUnique.mockResolvedValue(null);

    await expect(getPaymentsSummary("non-existent")).rejects.toThrow(LoanNotFoundError);
  });
});

// ============================================
// getTodayPayments
// ============================================

describe("getTodayPayments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return payments made today", async () => {
    const todayPayments = [
      {
        ...createMockPayment(),
        loan: {
          ...createMockLoan(),
          client: { id: "client-1", firstName: "Juan", lastName: "Pérez", documentId: "001-1234567-8" },
        },
        createdBy: { id: "user-1", firstName: "Admin", lastName: "User" },
      },
    ];

    prismaMock.payment.findMany.mockResolvedValue(todayPayments);

    const result = await getTodayPayments();

    expect(result).toHaveLength(1);
    expect(prismaMock.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          paymentDate: expect.objectContaining({
            gte: expect.any(Date),
            lt: expect.any(Date),
          }),
        }),
      })
    );
  });

  it("should return empty array when no payments today", async () => {
    prismaMock.payment.findMany.mockResolvedValue([]);

    const result = await getTodayPayments();

    expect(result).toHaveLength(0);
  });
});
