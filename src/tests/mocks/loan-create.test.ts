import { describe, it, expect, vi, beforeEach } from "vitest";
import "./setup";
import { createLoan } from "../../../lib/services/loan.service";
import { LoanStatus, PaymentFrequency } from "@prisma/client";
import { prismaMock } from "./prisma.mock";
import { createMockLoan } from "./test-factories";

describe("createLoan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
