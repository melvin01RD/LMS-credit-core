import { describe, it, expect, vi } from "vitest";
import { createLoan } from "../../lib/services/loan.service";
import { LoanStatus } from "@prisma/client";
import { prismaMock } from "./mocks/prisma.mock";

vi.mock("../../lib/db/prisma", async () => {
  const { prismaMock } = await import("./mocks/prisma.mock");
  return { prisma: prismaMock };
});

vi.mock("@/lib/db/prisma", async () => {
  const { prismaMock } = await import("./mocks/prisma.mock");
  return { prisma: prismaMock };
});

describe("Loan Service", () => {
  it("creates a loan with ACTIVE status and correct amounts", async () => {
    
    const mockedLoan = {
      id: "loan-1",
      status: LoanStatus.ACTIVE,
      remainingCapital: 1000,
      installmentAmount: 100,
      clientId: "client-1",
      principalAmount: 1000,
      annualInterestRate: 24,
      termCount: 10,
      paymentFrequency: "MONTHLY",
      createdById: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    prismaMock.loan.create.mockResolvedValue(mockedLoan as any);

    const result = await createLoan({
      clientId: "client-1",
      principalAmount: 1000,
      annualInterestRate: 24,
      termCount: 10,
      paymentFrequency: "MONTHLY",
      createdById: "user-1",
    });

    // Assert
    expect(prismaMock.loan.create).toHaveBeenCalledOnce();
    const callArgs = prismaMock.loan.create.mock.calls[0][0];
    
    // Verify arguments passed to create
    expect(callArgs.data.status).toBe(LoanStatus.ACTIVE);
    expect(callArgs.data.remainingCapital).toBe(1000); // 1000
    expect(callArgs.data.installmentAmount).toBe(100); // 1000 / 10

    // Verify result
    expect(result.status).toBe(LoanStatus.ACTIVE);
  });
});
