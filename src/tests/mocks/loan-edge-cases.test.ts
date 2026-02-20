import { describe, it, expect, vi, beforeEach } from "vitest";
import "./setup";
import { createPayment } from "../../../lib/services/payment.service";
import { applyPayment } from "../../../lib/domain/loan";
import { LoanStatus, PaymentType } from "@prisma/client";
import { prismaMock } from "./prisma.mock";
import { createMockLoan, createMockPayment } from "./test-factories";

describe("Edge Cases - Payment Processing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should handle decimal precision in payments", async () => {
    const mockLoan = createMockLoan({ remainingCapital: 1000.5 });
    const mockPayment = createMockPayment({
      totalAmount: 100.25,
      capitalApplied: 80.15,
      interestApplied: 20.1,
    });
    const updatedLoan = createMockLoan({ remainingCapital: 920.35 });

    prismaMock.loan.findUnique.mockResolvedValue(mockLoan);
    prismaMock.$transaction.mockImplementation(async (callback) => {
      const txMock = {
        loan: {
          findUnique: vi.fn().mockResolvedValue(mockLoan),
          update: vi.fn().mockResolvedValue(updatedLoan),
        },
        payment: {
          create: vi.fn().mockResolvedValue(mockPayment),
        },
        paymentSchedule: {
          findFirst: vi.fn().mockResolvedValue(null),
          update: vi.fn().mockResolvedValue({}),
        },
      };
      return callback(txMock);
    });

    const result = await createPayment({
      loanId: "loan-1",
      totalAmount: 100.25,
      capitalApplied: 80.15,
      interestApplied: 20.1,
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

    prismaMock.loan.findUnique.mockResolvedValue(mockLoan);
    prismaMock.$transaction.mockImplementation(async (callback) => {
      const txMock = {
        loan: {
          findUnique: vi.fn().mockResolvedValue(mockLoan),
          update: vi.fn().mockResolvedValue(updatedLoan),
        },
        payment: {
          create: vi.fn().mockResolvedValue(mockPayment),
        },
        paymentSchedule: {
          findFirst: vi.fn().mockResolvedValue(null),
          update: vi.fn().mockResolvedValue({}),
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
