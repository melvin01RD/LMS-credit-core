import { describe, it, expect, vi, beforeEach } from "vitest";
import "./setup";
import { createPayment } from "../../../lib/services/payment.service";
import {
  LoanNotFoundError,
  PaymentNotAllowedError,
  PaymentExceedsBalanceError,
  InvalidPaymentAmountError,
} from "../../../lib/errors";
import { LoanStatus, PaymentType, PaymentFrequency } from "@prisma/client";
import { prismaMock } from "./prisma.mock";
import { createMockLoan, createMockPayment } from "./test-factories";

// ============================================
// Helper: setup transaction mock
// ============================================
function setupTransaction(
  loan: ReturnType<typeof createMockLoan> | null,
  payment?: ReturnType<typeof createMockPayment>,
  updatedLoan?: ReturnType<typeof createMockLoan>
) {
  prismaMock.$transaction.mockImplementation(async (callback: any) => {
    const txMock = {
      loan: {
        findUnique: vi.fn().mockResolvedValue(loan),
        update: vi.fn().mockResolvedValue(updatedLoan ?? loan),
      },
      payment: {
        create: vi.fn().mockResolvedValue(payment),
      },
    };
    return callback(txMock);
  });
}

describe("createPayment - Happy Path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should register a payment with manual distribution", async () => {
    const mockLoan = createMockLoan({ remainingCapital: 10000 });
    const mockPayment = createMockPayment();
    const updatedLoan = createMockLoan({ remainingCapital: 9200 });

    setupTransaction(mockLoan, mockPayment, updatedLoan);

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
    expect(result.newBalance).toBeDefined();
  });

  it("should mark loan as PAID when balance reaches zero", async () => {
    const mockLoan = createMockLoan({ remainingCapital: 800 });
    const mockPayment = createMockPayment({ capitalApplied: 800 });
    const updatedLoan = createMockLoan({ remainingCapital: 0, status: LoanStatus.PAID });

    setupTransaction(mockLoan, mockPayment, updatedLoan);

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

  it("should allow payment on OVERDUE loan", async () => {
    const overdueLoan = createMockLoan({ status: LoanStatus.OVERDUE, remainingCapital: 5000 });
    const mockPayment = createMockPayment();
    const updatedLoan = createMockLoan({ remainingCapital: 4200 });

    setupTransaction(overdueLoan, mockPayment, updatedLoan);

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

  it("should include late fee in payment distribution", async () => {
    const mockLoan = createMockLoan({ remainingCapital: 10000 });
    const mockPayment = createMockPayment({
      totalAmount: 1100,
      capitalApplied: 800,
      interestApplied: 200,
      lateFeeApplied: 100,
    });
    const updatedLoan = createMockLoan({ remainingCapital: 9200 });

    setupTransaction(mockLoan, mockPayment, updatedLoan);

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

  it("should handle capital-only payment", async () => {
    const mockLoan = createMockLoan({ remainingCapital: 5000 });
    const mockPayment = createMockPayment({
      totalAmount: 1000,
      capitalApplied: 1000,
      interestApplied: 0,
      type: PaymentType.CAPITAL_PAYMENT,
    });
    const updatedLoan = createMockLoan({ remainingCapital: 4000 });

    setupTransaction(mockLoan, mockPayment, updatedLoan);

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

describe("createPayment - Validation Errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should throw LoanNotFoundError when loan does not exist", async () => {
    setupTransaction(null);

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
    setupTransaction(paidLoan);

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

  it("should throw InvalidPaymentAmountError for negative capital", async () => {
    await expect(
      createPayment({
        loanId: "loan-1",
        totalAmount: 1000,
        capitalApplied: -500,
        interestApplied: 1500,
        type: PaymentType.REGULAR,
        createdById: "user-1",
      })
    ).rejects.toThrow(InvalidPaymentAmountError);
  });

  it("should throw PaymentExceedsBalanceError when capital exceeds remaining", async () => {
    const mockLoan = createMockLoan({ remainingCapital: 500 });
    setupTransaction(mockLoan);

    await expect(
      createPayment({
        loanId: "loan-1",
        totalAmount: 1000,
        capitalApplied: 1000,
        interestApplied: 0,
        type: PaymentType.REGULAR,
        createdById: "user-1",
      })
    ).rejects.toThrow(PaymentExceedsBalanceError);
  });
});
