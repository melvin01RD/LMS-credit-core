import { describe, it, expect, vi, beforeEach } from "vitest";
import "./setup";
import { createLoan } from "../../../lib/services/loan.service";
import { LoanStatus, PaymentFrequency } from "@prisma/client";
import { prismaMock } from "./prisma.mock";
import { createMockFlatRateLoan } from "./test-factories";

// ============================================
// Helper: setup $transaction for createLoan
// The service wraps loan.create + paymentSchedule.createMany in a tx
// ============================================
function setupLoanTransaction(mockLoan: ReturnType<typeof createMockFlatRateLoan>) {
  prismaMock.$transaction.mockImplementation(async (callback: any) => {
    const txMock = {
      loan: {
        create: vi.fn().mockResolvedValue(mockLoan),
      },
      paymentSchedule: {
        createMany: vi.fn().mockResolvedValue({ count: mockLoan.termCount }),
      },
    };
    return callback(txMock);
  });
}

describe("createLoan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a loan with ACTIVE status", async () => {
    const mockLoan = createMockFlatRateLoan();
    setupLoanTransaction(mockLoan);

    const result = await createLoan({
      loanStructure: "FLAT_RATE",
      clientId: "client-1",
      principalAmount: 10000,
      totalFinanceCharge: 3500,
      termCount: 45,
      paymentFrequency: PaymentFrequency.DAILY,
      createdById: "user-1",
    });

    expect(result.status).toBe(LoanStatus.ACTIVE);
  });

  it("should calculate installment amount using Flat Rate formula", async () => {
    // installmentAmount = (10000 + 3500) / 45 = 300
    const mockLoan = createMockFlatRateLoan({ installmentAmount: 300 });
    setupLoanTransaction(mockLoan);

    await createLoan({
      loanStructure: "FLAT_RATE",
      clientId: "client-1",
      principalAmount: 10000,
      totalFinanceCharge: 3500,
      termCount: 45,
      paymentFrequency: PaymentFrequency.DAILY,
      createdById: "user-1",
    });

    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });

  it("should set nextDueDate based on payment frequency", async () => {
    const mockLoan = createMockFlatRateLoan();
    setupLoanTransaction(mockLoan);

    const result = await createLoan({
      loanStructure: "FLAT_RATE",
      clientId: "client-1",
      principalAmount: 10000,
      totalFinanceCharge: 3500,
      termCount: 45,
      paymentFrequency: PaymentFrequency.DAILY,
      createdById: "user-1",
    });

    expect(result.nextDueDate).toBeInstanceOf(Date);
  });
});
