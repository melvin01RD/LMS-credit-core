import { describe, it, expect, vi, beforeEach } from "vitest";
import "./setup";
import { createPayment } from "../../../lib/services/payment.service";
import { applyPayment } from "../../../lib/domain/loan";
import { LoanStatus, PaymentType, ScheduleStatus } from "@prisma/client";
import { prismaMock } from "./prisma.mock";
import { createMockFlatRateLoan, createMockPayment } from "./test-factories";

describe("Edge Cases - Payment Processing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should handle decimal precision in payments", async () => {
    const mockLoan = createMockFlatRateLoan({ remainingCapital: 13200 });
    const mockPayment = createMockPayment({
      totalAmount: 300.25,
      capitalApplied: 222.22,
      interestApplied: 77.78,
    });
    const updatedLoan = createMockFlatRateLoan({ remainingCapital: 12900 });
    const pendingEntry = {
      id: "schedule-1",
      loanId: "loan-flat-1",
      installmentNumber: 1,
      dueDate: new Date(Date.now() + 86400000),
      expectedAmount: 300,
      status: ScheduleStatus.PENDING,
      paidAt: null,
      paymentId: null,
    };

    prismaMock.loan.findUnique.mockResolvedValue(mockLoan);
    prismaMock.paymentSchedule.findMany.mockResolvedValue([pendingEntry]);
    prismaMock.$transaction.mockImplementation(async (callback) => {
      const txMock = {
        loan: {
          update: vi.fn().mockResolvedValue(updatedLoan),
        },
        payment: {
          create: vi.fn().mockResolvedValue(mockPayment),
        },
        paymentSchedule: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findFirst: vi.fn().mockResolvedValue(null),
        },
      };
      return callback(txMock);
    });

    const result = await createPayment({
      loanId: "loan-flat-1",
      totalAmount: 300.25,
      type: PaymentType.REGULAR,
      createdById: "user-1",
    });

    expect(result.payment).toBeDefined();
  });

  it("should handle capital-only payments", async () => {
    const mockLoan = createMockFlatRateLoan({ remainingCapital: 13200 });
    const mockPayment = createMockPayment({
      totalAmount: 300,
      capitalApplied: 222.22,
      interestApplied: 77.78,
      type: PaymentType.CAPITAL_PAYMENT,
    });
    const updatedLoan = createMockFlatRateLoan({ remainingCapital: 12900 });
    const pendingEntry = {
      id: "schedule-1",
      loanId: "loan-flat-1",
      installmentNumber: 1,
      dueDate: new Date(Date.now() + 86400000),
      expectedAmount: 300,
      status: ScheduleStatus.PENDING,
      paidAt: null,
      paymentId: null,
    };

    prismaMock.loan.findUnique.mockResolvedValue(mockLoan);
    prismaMock.paymentSchedule.findMany.mockResolvedValue([pendingEntry]);
    prismaMock.$transaction.mockImplementation(async (callback) => {
      const txMock = {
        loan: {
          update: vi.fn().mockResolvedValue(updatedLoan),
        },
        payment: {
          create: vi.fn().mockResolvedValue(mockPayment),
        },
        paymentSchedule: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findFirst: vi.fn().mockResolvedValue(null),
        },
      };
      return callback(txMock);
    });

    const result = await createPayment({
      loanId: "loan-flat-1",
      totalAmount: 300,
      type: PaymentType.CAPITAL_PAYMENT,
      createdById: "user-1",
    });

    expect(result.payment.type).toBe(PaymentType.CAPITAL_PAYMENT);
  });
});

describe("Edge Cases - Domain Logic", () => {
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
    const result = applyPayment(100.5, 50.25);

    expect(result.balance).toBeCloseTo(50.25, 2);
    expect(result.status).toBe(LoanStatus.ACTIVE);
  });
});
