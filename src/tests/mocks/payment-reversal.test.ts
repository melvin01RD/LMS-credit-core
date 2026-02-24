import { describe, it, expect, vi, beforeEach } from "vitest";
import "./setup";
import { reversePayment } from "../../../lib/services/payment.service";
import {
  PaymentNotFoundError,
  CannotReversePaymentError,
} from "../../../lib/errors";
import { LoanStatus, PaymentType } from "@prisma/client";
import { prismaMock } from "./prisma.mock";
import { createMockPayment, createMockFlatRateLoan, createMockClient } from "./test-factories";

// ============================================
// Helper: setup transaction mock for Flat Rate reversal
// Flat Rate reversal requires: payment.findUnique, payment.create,
// paymentSchedule.updateMany, paymentSchedule.findFirst, loan.update
// ============================================
function setupReversalTransaction(
  originalPayment: any | null,
  reversalPayment?: any,
  updatedLoan?: any
) {
  prismaMock.$transaction.mockImplementation(async (callback: any) => {
    const txMock = {
      payment: {
        findUnique: vi.fn().mockResolvedValue(originalPayment),
        create: vi.fn().mockResolvedValue(reversalPayment),
      },
      loan: {
        update: vi.fn().mockResolvedValue(updatedLoan),
      },
      paymentSchedule: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    return callback(txMock);
  });
}

describe("reversePayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should reverse a payment and restore loan balance", async () => {
    const originalPayment = {
      ...createMockPayment({
        capitalApplied: 222,
        interestApplied: 78,
        totalAmount: 300,
        installmentsCovered: 1,
      }),
      loan: createMockFlatRateLoan({ remainingCapital: 13200, status: LoanStatus.ACTIVE, installmentsPaid: 1 }),
    };

    const reversalPayment = createMockPayment({
      id: "reversal-1",
      totalAmount: -300,
      capitalApplied: -222,
      interestApplied: -78,
    });

    const updatedLoan = {
      ...createMockFlatRateLoan({ remainingCapital: 13500 }),
      client: createMockClient(),
    };

    setupReversalTransaction(originalPayment, reversalPayment, updatedLoan);

    const result = await reversePayment("payment-1", "user-1", "Error en el pago");

    expect(result.payment).toBeDefined();
    expect(result.previousBalance).toBe(13200);
    expect(result.newBalance).toBe(13500); // 13200 + 300 (totalAmount restored)
  });

  it("should reactivate a PAID loan when payment is reversed", async () => {
    const originalPayment = {
      ...createMockPayment({ capitalApplied: 222, totalAmount: 300, installmentsCovered: 1 }),
      loan: createMockFlatRateLoan({ remainingCapital: 0, status: LoanStatus.PAID, installmentsPaid: 45 }),
    };

    const reversalPayment = createMockPayment({ id: "reversal-1" });
    const updatedLoan = {
      ...createMockFlatRateLoan({ remainingCapital: 300, status: LoanStatus.ACTIVE }),
      client: createMockClient(),
    };

    setupReversalTransaction(originalPayment, reversalPayment, updatedLoan);

    const result = await reversePayment("payment-1", "user-1", "Reversal");

    expect(result.statusChanged).toBe(true);
  });

  it("should throw PaymentNotFoundError when payment does not exist", async () => {
    setupReversalTransaction(null);

    await expect(
      reversePayment("non-existent", "user-1", "Reason")
    ).rejects.toThrow(PaymentNotFoundError);
  });

  it("should throw CannotReversePaymentError for canceled loan", async () => {
    const originalPayment = {
      ...createMockPayment(),
      loan: createMockFlatRateLoan({ status: LoanStatus.CANCELED }),
    };

    setupReversalTransaction(originalPayment);

    await expect(
      reversePayment("payment-1", "user-1", "Reason")
    ).rejects.toThrow(CannotReversePaymentError);
  });
});
