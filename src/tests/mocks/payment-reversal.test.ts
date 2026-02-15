import { describe, it, expect, vi, beforeEach } from "vitest";
import "./setup";
import { reversePayment } from "../../../lib/services/payment.service";
import {
  PaymentNotFoundError,
  CannotReversePaymentError,
} from "../../../lib/errors";
import { LoanStatus, PaymentType, PaymentFrequency } from "@prisma/client";
import { prismaMock } from "./prisma.mock";
import { createMockPayment, createMockLoan, createMockClient } from "./test-factories";

// ============================================
// Helper: setup transaction mock for reversal
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
      ...createMockPayment({ capitalApplied: 800, interestApplied: 200, totalAmount: 1000 }),
      loan: createMockLoan({ remainingCapital: 9200, status: LoanStatus.ACTIVE }),
    };

    const reversalPayment = createMockPayment({
      id: "reversal-1",
      totalAmount: -1000,
      capitalApplied: -800,
      interestApplied: -200,
    });

    const updatedLoan = {
      ...createMockLoan({ remainingCapital: 10000 }),
      client: createMockClient(),
    };

    setupReversalTransaction(originalPayment, reversalPayment, updatedLoan);

    const result = await reversePayment("payment-1", "user-1", "Error en el pago");

    expect(result.payment).toBeDefined();
    expect(result.previousBalance).toBe(9200);
    expect(result.newBalance).toBe(10000); // 9200 + 800 restored
  });

  it("should reactivate a PAID loan when payment is reversed", async () => {
    const originalPayment = {
      ...createMockPayment({ capitalApplied: 500, totalAmount: 700 }),
      loan: createMockLoan({ remainingCapital: 0, status: LoanStatus.PAID }),
    };

    const reversalPayment = createMockPayment({ id: "reversal-1" });
    const updatedLoan = {
      ...createMockLoan({ remainingCapital: 500, status: LoanStatus.ACTIVE }),
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
      loan: createMockLoan({ status: LoanStatus.CANCELED }),
    };

    setupReversalTransaction(originalPayment);

    await expect(
      reversePayment("payment-1", "user-1", "Reason")
    ).rejects.toThrow(CannotReversePaymentError);
  });
});
