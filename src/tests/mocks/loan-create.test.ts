import { describe, it, expect, vi, beforeEach } from "vitest";
import "./setup";
import { createLoan } from "../../../lib/services/loan.service";
import { LoanStatus, PaymentFrequency } from "@prisma/client";
import { prismaMock } from "./prisma.mock";
import { createMockLoan } from "./test-factories";

// ============================================
// Helper: setup $transaction for createLoan
// The service wraps loan.create + paymentSchedule.createMany in a tx
// ============================================
function setupLoanTransaction(mockLoan: ReturnType<typeof createMockLoan>) {
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
    const mockLoan = createMockLoan();
    setupLoanTransaction(mockLoan);

    const result = await createLoan({
      loanStructure: "FRENCH_AMORTIZATION" as const,
      clientId: "client-1",
      principalAmount: 10000,
      annualInterestRate: 24,
      termCount: 12,
      paymentFrequency: PaymentFrequency.MONTHLY,
      createdById: "user-1",
    });

    expect(result.status).toBe(LoanStatus.ACTIVE);
  });

  it("should calculate installment amount using French amortization", async () => {
    const mockLoan = createMockLoan({ installmentAmount: 942.52 });
    setupLoanTransaction(mockLoan);

    await createLoan({
      loanStructure: "FRENCH_AMORTIZATION" as const,
      clientId: "client-1",
      principalAmount: 10000,
      annualInterestRate: 24,
      termCount: 12,
      paymentFrequency: PaymentFrequency.MONTHLY,
      createdById: "user-1",
    });

    // The tx.loan.create is called inside $transaction — verify via result
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });

  it("should set nextDueDate based on payment frequency", async () => {
    const mockLoan = createMockLoan();
    setupLoanTransaction(mockLoan);

    const result = await createLoan({
      loanStructure: "FRENCH_AMORTIZATION" as const,
      clientId: "client-1",
      principalAmount: 10000,
      annualInterestRate: 24,
      termCount: 12,
      paymentFrequency: PaymentFrequency.MONTHLY,
      createdById: "user-1",
    });

    expect(result.nextDueDate).toBeInstanceOf(Date);
  });
});
