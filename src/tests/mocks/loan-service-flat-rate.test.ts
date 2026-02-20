import { describe, it, expect, vi, beforeEach } from "vitest";
import "./setup";
import {
  createLoan,
  getLoanSchedule,
  getPendingScheduleEntries,
} from "../../../lib/services/loan.service";
import { LoanNotFoundError } from "../../../lib/errors";
import { LoanStatus, PaymentFrequency, ScheduleStatus } from "@prisma/client";
import { prismaMock } from "./prisma.mock";
import {
  createMockFlatRateLoan,
  createMockFlatRateWeeklyLoan,
  createMockSchedule,
} from "./test-factories";

// ============================================
// Helper: setup $transaction for createLoan FLAT_RATE
// tx needs: loan.create + paymentSchedule.createMany
// ============================================
function setupFlatRateLoanTransaction(
  mockLoan: ReturnType<typeof createMockFlatRateLoan>,
  scheduleCount: number
) {
  prismaMock.$transaction.mockImplementation(async (callback: any) => {
    const txMock = {
      loan: {
        create: vi.fn().mockResolvedValue(mockLoan),
      },
      paymentSchedule: {
        createMany: vi.fn().mockResolvedValue({ count: scheduleCount }),
      },
    };
    return callback(txMock);
  });
}

// ============================================
// createLoan - FLAT_RATE
// ============================================

describe("createLoan - FLAT_RATE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("crea préstamo diario con los campos correctos", async () => {
    const mockLoan = createMockFlatRateLoan();
    setupFlatRateLoanTransaction(mockLoan, 45);

    const result = await createLoan({
      loanStructure: "FLAT_RATE" as const,
      clientId: "client-1",
      principalAmount: 10000,
      totalFinanceCharge: 3500,
      termCount: 45,
      paymentFrequency: PaymentFrequency.DAILY,
      createdById: "user-1",
    });

    expect(result.loanStructure).toBe("FLAT_RATE");
    expect(result.status).toBe(LoanStatus.ACTIVE);
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });

  it("crea préstamo semanal con installmentAmount correcto", async () => {
    const mockWeeklyLoan = createMockFlatRateWeeklyLoan();
    prismaMock.$transaction.mockImplementation(async (callback: any) => {
      const txMock = {
        loan: {
          create: vi.fn().mockResolvedValue(mockWeeklyLoan),
        },
        paymentSchedule: {
          createMany: vi.fn().mockResolvedValue({ count: 8 }),
        },
      };
      return callback(txMock);
    });

    const result = await createLoan({
      loanStructure: "FLAT_RATE" as const,
      clientId: "client-1",
      principalAmount: 10000,
      totalFinanceCharge: 2000,
      termCount: 8,
      paymentFrequency: PaymentFrequency.WEEKLY,
      createdById: "user-1",
    });

    // 12000 / 8 = 1500
    expect(result.installmentAmount).toBe(1500);
  });

  it("crea el PaymentSchedule con 45 entradas para préstamo diario", async () => {
    const mockLoan = createMockFlatRateLoan();
    let capturedCreateMany: any;

    prismaMock.$transaction.mockImplementation(async (callback: any) => {
      const txMock = {
        loan: { create: vi.fn().mockResolvedValue(mockLoan) },
        paymentSchedule: {
          createMany: vi.fn().mockImplementation((args: any) => {
            capturedCreateMany = args;
            return Promise.resolve({ count: args.data.length });
          }),
        },
      };
      return callback(txMock);
    });

    await createLoan({
      loanStructure: "FLAT_RATE" as const,
      clientId: "client-1",
      principalAmount: 10000,
      totalFinanceCharge: 3500,
      termCount: 45,
      paymentFrequency: PaymentFrequency.DAILY,
      createdById: "user-1",
    });

    expect(capturedCreateMany.data).toHaveLength(45);
  });

  it("crea el PaymentSchedule con 8 entradas para préstamo semanal", async () => {
    const mockLoan = createMockFlatRateWeeklyLoan();
    let capturedCreateMany: any;

    prismaMock.$transaction.mockImplementation(async (callback: any) => {
      const txMock = {
        loan: { create: vi.fn().mockResolvedValue(mockLoan) },
        paymentSchedule: {
          createMany: vi.fn().mockImplementation((args: any) => {
            capturedCreateMany = args;
            return Promise.resolve({ count: args.data.length });
          }),
        },
      };
      return callback(txMock);
    });

    await createLoan({
      loanStructure: "FLAT_RATE" as const,
      clientId: "client-1",
      principalAmount: 10000,
      totalFinanceCharge: 2000,
      termCount: 8,
      paymentFrequency: PaymentFrequency.WEEKLY,
      createdById: "user-1",
    });

    expect(capturedCreateMany.data).toHaveLength(8);
  });

  it("nextDueDate es la fecha del primer schedule entry", async () => {
    const mockLoan = createMockFlatRateLoan();
    setupFlatRateLoanTransaction(mockLoan, 45);

    const result = await createLoan({
      loanStructure: "FLAT_RATE" as const,
      clientId: "client-1",
      principalAmount: 10000,
      totalFinanceCharge: 3500,
      termCount: 45,
      paymentFrequency: PaymentFrequency.DAILY,
      createdById: "user-1",
    });

    // nextDueDate should be tomorrow (first schedule entry)
    expect(result.nextDueDate).toBeInstanceOf(Date);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(result.nextDueDate!.toDateString()).toBe(tomorrow.toDateString());
  });

  it("annualInterestRate es null en Flat Rate", async () => {
    const mockLoan = createMockFlatRateLoan({ annualInterestRate: null });
    setupFlatRateLoanTransaction(mockLoan, 45);

    const result = await createLoan({
      loanStructure: "FLAT_RATE" as const,
      clientId: "client-1",
      principalAmount: 10000,
      totalFinanceCharge: 3500,
      termCount: 45,
      paymentFrequency: PaymentFrequency.DAILY,
      createdById: "user-1",
    });

    expect(result.annualInterestRate).toBeNull();
  });
});

// ============================================
// getLoanSchedule
// ============================================

describe("getLoanSchedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna las cuotas ordenadas por installmentNumber", async () => {
    const mockLoan = createMockFlatRateLoan();
    const schedule = createMockSchedule("loan-flat-1", 45, 300);

    prismaMock.loan.findUnique.mockResolvedValue(mockLoan);
    prismaMock.paymentSchedule.findMany.mockResolvedValue(schedule);

    const result = await getLoanSchedule("loan-flat-1");

    expect(result).toHaveLength(45);
    expect(result[0].installmentNumber).toBe(1);
    expect(prismaMock.paymentSchedule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { installmentNumber: "asc" },
      })
    );
  });

  it("lanza LoanNotFoundError si el préstamo no existe", async () => {
    prismaMock.loan.findUnique.mockResolvedValue(null);

    await expect(getLoanSchedule("non-existent")).rejects.toThrow(LoanNotFoundError);
  });
});

// ============================================
// getPendingScheduleEntries
// ============================================

describe("getPendingScheduleEntries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna solo cuotas con status PENDING u OVERDUE", async () => {
    const pending = createMockSchedule("loan-flat-1", 3, 300);
    // The service queries with status: { in: [PENDING, OVERDUE] } — mock returns only matching
    prismaMock.paymentSchedule.findMany.mockResolvedValue(pending);

    const result = await getPendingScheduleEntries("loan-flat-1");

    expect(prismaMock.paymentSchedule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          loanId: "loan-flat-1",
          status: { in: [ScheduleStatus.PENDING, ScheduleStatus.OVERDUE] },
        }),
      })
    );
    expect(result).toHaveLength(3);
  });

  it("retorna cuotas ordenadas por installmentNumber asc", async () => {
    const entries = createMockSchedule("loan-flat-1", 5, 300);
    prismaMock.paymentSchedule.findMany.mockResolvedValue(entries);

    await getPendingScheduleEntries("loan-flat-1");

    expect(prismaMock.paymentSchedule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { installmentNumber: "asc" },
      })
    );
  });
});
