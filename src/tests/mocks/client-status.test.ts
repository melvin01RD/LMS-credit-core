import { describe, it, expect, vi, beforeEach } from "vitest";
import "./setup";
import {
  deactivateClient,
  reactivateClient,
  deleteClient,
  getClientWithLoanHistory,
} from "../../../lib/services/client.service";
import { ClientNotFoundError, ClientHasActiveLoansError } from "../../../lib/errors";
import { LoanStatus, PaymentFrequency } from "@prisma/client";
import { prismaMock } from "./prisma.mock";
import { createMockClient } from "./test-factories";

// ============================================
// Helper: mock loan for client tests
// ============================================
const createClientLoan = (overrides = {}) => ({
  id: "loan-1",
  clientId: "client-1",
  loanStructure: "FLAT_RATE",
  principalAmount: 10000,
  annualInterestRate: null,
  totalFinanceCharge: 2000,
  totalPayableAmount: 12000,
  paymentFrequency: PaymentFrequency.WEEKLY,
  termCount: 8,
  installmentAmount: 1250,
  remainingCapital: 12000,
  installmentsPaid: 0,
  status: LoanStatus.ACTIVE,
  nextDueDate: new Date(),
  guarantees: null,
  createdById: "user-1",
  updatedById: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  payments: [],
  ...overrides,
});

// ============================================
// deactivateClient
// ============================================

describe("deactivateClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should deactivate a client with no active loans", async () => {
    const clientWithNoLoans = { ...createMockClient(), loans: [] };
    const deactivatedClient = createMockClient({ active: false });

    prismaMock.client.findUnique.mockResolvedValue(clientWithNoLoans);
    prismaMock.client.update.mockResolvedValue(deactivatedClient);

    const result = await deactivateClient("client-1");

    expect(result.active).toBe(false);
    expect(prismaMock.client.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { active: false },
      })
    );
  });

  it("should throw ClientHasActiveLoansError when client has active loans", async () => {
    const clientWithLoans = {
      ...createMockClient(),
      loans: [createClientLoan({ status: LoanStatus.ACTIVE })],
    };

    prismaMock.client.findUnique.mockResolvedValue(clientWithLoans);

    await expect(deactivateClient("client-1")).rejects.toThrow(ClientHasActiveLoansError);
  });

  it("should throw ClientHasActiveLoansError when client has overdue loans", async () => {
    const clientWithOverdue = {
      ...createMockClient(),
      loans: [createClientLoan({ status: LoanStatus.OVERDUE })],
    };

    prismaMock.client.findUnique.mockResolvedValue(clientWithOverdue);

    await expect(deactivateClient("client-1")).rejects.toThrow(ClientHasActiveLoansError);
  });

  it("should throw ClientNotFoundError when client does not exist", async () => {
    prismaMock.client.findUnique.mockResolvedValue(null);

    await expect(deactivateClient("non-existent")).rejects.toThrow(ClientNotFoundError);
  });
});

// ============================================
// reactivateClient
// ============================================

describe("reactivateClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should reactivate an inactive client", async () => {
    const inactiveClient = createMockClient({ active: false });
    const reactivatedClient = createMockClient({ active: true });

    prismaMock.client.findUnique.mockResolvedValue(inactiveClient);
    prismaMock.client.update.mockResolvedValue(reactivatedClient);

    const result = await reactivateClient("client-1");

    expect(result.active).toBe(true);
  });

  it("should throw ClientNotFoundError when client does not exist", async () => {
    prismaMock.client.findUnique.mockResolvedValue(null);

    await expect(reactivateClient("non-existent")).rejects.toThrow(ClientNotFoundError);
  });
});

// ============================================
// deleteClient
// ============================================

describe("deleteClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete a client with no loans", async () => {
    const clientNoLoans = { ...createMockClient(), _count: { loans: 0 } };
    prismaMock.client.findUnique.mockResolvedValue(clientNoLoans);
    prismaMock.client.delete.mockResolvedValue(clientNoLoans);

    const result = await deleteClient("client-1");

    expect(result).toBeDefined();
    expect(prismaMock.client.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "client-1" } })
    );
  });

  it("should throw ClientHasActiveLoansError when client has loans", async () => {
    const clientWithLoans = { ...createMockClient(), _count: { loans: 3 } };
    prismaMock.client.findUnique.mockResolvedValue(clientWithLoans);

    await expect(deleteClient("client-1")).rejects.toThrow(ClientHasActiveLoansError);
  });

  it("should throw ClientNotFoundError when client does not exist", async () => {
    prismaMock.client.findUnique.mockResolvedValue(null);

    await expect(deleteClient("non-existent")).rejects.toThrow(ClientNotFoundError);
  });
});

// ============================================
// getClientWithLoanHistory
// ============================================

describe("getClientWithLoanHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return client with loan stats", async () => {
    const clientWithLoans = {
      ...createMockClient(),
      loans: [
        createClientLoan({ status: LoanStatus.ACTIVE, principalAmount: 10000, remainingCapital: 8000 }),
        createClientLoan({ id: "loan-2", status: LoanStatus.PAID, principalAmount: 5000, remainingCapital: 0 }),
        createClientLoan({ id: "loan-3", status: LoanStatus.OVERDUE, principalAmount: 20000, remainingCapital: 15000 }),
      ],
    };

    prismaMock.client.findUnique.mockResolvedValue(clientWithLoans);

    const result = await getClientWithLoanHistory("client-1");

    expect(result.stats.totalLoans).toBe(3);
    expect(result.stats.activeLoans).toBe(1);
    expect(result.stats.overdueLoans).toBe(1);
    expect(result.stats.paidLoans).toBe(1);
    expect(result.stats.totalBorrowed).toBe(35000);
    expect(result.stats.totalOutstanding).toBe(23000); // 8000 + 15000
  });

  it("should return zero stats for client with no loans", async () => {
    const clientNoLoans = { ...createMockClient(), loans: [] };
    prismaMock.client.findUnique.mockResolvedValue(clientNoLoans);

    const result = await getClientWithLoanHistory("client-1");

    expect(result.stats.totalLoans).toBe(0);
    expect(result.stats.totalBorrowed).toBe(0);
    expect(result.stats.totalOutstanding).toBe(0);
  });

  it("should throw ClientNotFoundError when client does not exist", async () => {
    prismaMock.client.findUnique.mockResolvedValue(null);

    await expect(getClientWithLoanHistory("non-existent")).rejects.toThrow(ClientNotFoundError);
  });
});
