import { describe, it, expect, vi, beforeEach } from "vitest";
import "./setup";
import {
  getLoanById,
  getLoans,
  getLoanPayments,
  getLoanSummary,
} from "../../../lib/services/loan.service";
import { LoanNotFoundError } from "../../../lib/errors";
import { LoanStatus } from "@prisma/client";
import { prismaMock } from "./prisma.mock";
import {
  createMockLoan,
  createMockPayment,
  createMockClient,
} from "./test-factories";

describe("getLoanById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return loan with relations", async () => {
    const mockLoan = {
      ...createMockLoan(),
      client: createMockClient(),
      payments: [],
      createdBy: { id: "user-1", firstName: "Admin", lastName: "User", email: "admin@test.com" },
      updatedBy: null,
    };

    prismaMock.loan.findUnique.mockResolvedValue(mockLoan);

    const result = await getLoanById("loan-1");

    expect(result.client).toBeDefined();
    expect(result.payments).toBeDefined();
  });

  it("should throw LoanNotFoundError when not found", async () => {
    prismaMock.loan.findUnique.mockResolvedValue(null);

    await expect(getLoanById("non-existent")).rejects.toThrow(LoanNotFoundError);
  });
});

describe("getLoans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return all loans without filters", async () => {
    const mockLoans = [createMockLoan(), createMockLoan({ id: "loan-2" })];
    prismaMock.loan.findMany.mockResolvedValue(mockLoans);
    prismaMock.loan.count.mockResolvedValue(2);

    const result = await getLoans();

    expect(result.data).toHaveLength(2);
  });

  it("should filter by clientId", async () => {
    prismaMock.loan.findMany.mockResolvedValue([createMockLoan()]);
    prismaMock.loan.count.mockResolvedValue(1);

    await getLoans({ clientId: "client-1" });

    expect(prismaMock.loan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ clientId: "client-1" }),
      })
    );
  });

  it("should filter by status", async () => {
    prismaMock.loan.findMany.mockResolvedValue([]);
    prismaMock.loan.count.mockResolvedValue(0);

    await getLoans({ status: LoanStatus.OVERDUE });

    expect(prismaMock.loan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: LoanStatus.OVERDUE }),
      })
    );
  });

  it("should combine multiple filters", async () => {
    prismaMock.loan.findMany.mockResolvedValue([]);
    prismaMock.loan.count.mockResolvedValue(0);

    await getLoans({ clientId: "client-1", status: LoanStatus.ACTIVE });

    expect(prismaMock.loan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ clientId: "client-1", status: LoanStatus.ACTIVE }),
      })
    );
  });
});

describe("getLoanPayments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return payments for a loan", async () => {
    const mockPayments = [
      createMockPayment(),
      createMockPayment({ id: "payment-2" }),
    ];

    prismaMock.loan.findUnique.mockResolvedValue(createMockLoan());
    prismaMock.payment.findMany.mockResolvedValue(mockPayments);

    const result = await getLoanPayments("loan-1");

    expect(result).toHaveLength(2);
  });

  it("should throw LoanNotFoundError when loan not found", async () => {
    prismaMock.loan.findUnique.mockResolvedValue(null);

    await expect(getLoanPayments("non-existent")).rejects.toThrow(LoanNotFoundError);
  });
});

describe("getLoanSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return loan summary with calculations", async () => {
    const mockLoan = {
      ...createMockLoan({ principalAmount: 10000, remainingCapital: 8000 }),
      client: createMockClient(),
      payments: [],
      createdBy: { id: "user-1", firstName: "Admin", lastName: "User", email: "admin@test.com" },
      updatedBy: null,
    };

    prismaMock.loan.findUnique.mockResolvedValue(mockLoan);
    prismaMock.payment.aggregate.mockResolvedValue({
      _sum: {
        totalAmount: 2500,
        capitalApplied: 2000,
        interestApplied: 500,
        lateFeeApplied: 0,
      },
      _count: 3,
    });

    const result = await getLoanSummary("loan-1");

    expect(result.summary.principalAmount).toBe(10000);
    expect(result.summary.remainingCapital).toBe(8000);
    expect(result.summary.capitalPaid).toBe(2000);
    expect(result.summary.paymentCount).toBe(3);
    expect(result.summary.progressPercentage).toBe(20);
  });
});
