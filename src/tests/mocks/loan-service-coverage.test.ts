import { describe, it, expect, vi, beforeEach } from "vitest";
import "./setup";
import {
  getLoanAmortization,
  getOverdueLoans,
  processOverdueLoans,
} from "../../../lib/services/loan.service";
import { LoanNotFoundError } from "../../../lib/errors";
import { LoanStatus, LoanStructure, PaymentFrequency, ScheduleStatus } from "@prisma/client";
import { prismaMock } from "./prisma.mock";
import { createMockFlatRateLoan, createMockSchedule } from "./test-factories";

// ============================================
// Helper: base French loan for amortization
// ============================================

const frenchLoan = {
  id: "loan-french-1",
  clientId: "client-1",
  loanStructure: LoanStructure.FRENCH_AMORTIZATION,
  principalAmount: 10000,
  annualInterestRate: 24,
  paymentFrequency: PaymentFrequency.MONTHLY,
  termCount: 12,
  installmentAmount: 942.52,
  remainingCapital: 10000,
  nextDueDate: new Date("2026-03-01"),
  status: LoanStatus.ACTIVE,
  guarantees: null,
  createdById: "user-1",
  updatedById: null,
  createdAt: new Date("2026-02-01"),
  updatedAt: new Date(),
};

// ============================================
// getLoanAmortization
// Lines 462-477
// ============================================

describe("getLoanAmortization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lanza LoanNotFoundError si el préstamo no existe", async () => {
    prismaMock.loan.findUnique.mockResolvedValue(null);

    await expect(getLoanAmortization("non-existent")).rejects.toThrow(LoanNotFoundError);
  });

  it("para FRENCH_AMORTIZATION retorna tabla de amortización con termCount entradas", async () => {
    prismaMock.loan.findUnique.mockResolvedValue(frenchLoan);

    const result = await getLoanAmortization("loan-french-1");

    // generateAmortizationSchedule returns 12 entries
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(12);
    // Each entry has the expected shape
    expect((result as any[])[0]).toHaveProperty("installmentNumber", 1);
    expect((result as any[])[0]).toHaveProperty("totalPayment");
    expect((result as any[])[0]).toHaveProperty("principalPayment");
    expect((result as any[])[0]).toHaveProperty("interestPayment");
    expect((result as any[])[0]).toHaveProperty("remainingBalance");
  });

  it("para FLAT_RATE delega a getLoanSchedule y retorna las cuotas del schedule", async () => {
    const flatLoan = createMockFlatRateLoan();
    const schedule = createMockSchedule("loan-flat-1", 45, 300);

    // getLoanAmortization calls loan.findUnique once
    // then getLoanSchedule calls loan.findUnique again + paymentSchedule.findMany
    prismaMock.loan.findUnique
      .mockResolvedValueOnce(flatLoan)  // getLoanAmortization
      .mockResolvedValueOnce(flatLoan); // getLoanSchedule
    prismaMock.paymentSchedule.findMany.mockResolvedValue(schedule);

    const result = await getLoanAmortization("loan-flat-1");

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(45);
    expect(prismaMock.paymentSchedule.findMany).toHaveBeenCalledOnce();
  });
});

// ============================================
// getOverdueLoans
// Lines 479-495
// ============================================

describe("getOverdueLoans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna préstamos ACTIVE con nextDueDate anterior a hoy", async () => {
    const overdueLoans = [
      {
        ...frenchLoan,
        id: "loan-overdue-1",
        status: LoanStatus.ACTIVE,
        nextDueDate: new Date(Date.now() - 5 * 86400000),
        client: { id: "client-1", firstName: "Juan", lastName: "Pérez", documentId: "001", phone: "809" },
      },
    ];
    prismaMock.loan.findMany.mockResolvedValue(overdueLoans);

    const result = await getOverdueLoans();

    expect(prismaMock.loan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: LoanStatus.ACTIVE }),
      })
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("loan-overdue-1");
  });

  it("retorna array vacío si no hay préstamos vencidos", async () => {
    prismaMock.loan.findMany.mockResolvedValue([]);

    const result = await getOverdueLoans();

    expect(result).toHaveLength(0);
  });
});

// ============================================
// processOverdueLoans
// Lines 497-523
// ============================================

describe("processOverdueLoans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("actualiza cuotas del schedule y préstamos a OVERDUE", async () => {
    prismaMock.paymentSchedule.updateMany.mockResolvedValue({ count: 3 });
    prismaMock.loan.updateMany.mockResolvedValue({ count: 3 });

    const result = await processOverdueLoans("user-1");

    expect(result.affected).toBe(3);
    expect(prismaMock.paymentSchedule.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: ScheduleStatus.PENDING }),
        data: { status: ScheduleStatus.OVERDUE },
      })
    );
    expect(prismaMock.loan.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: LoanStatus.ACTIVE }),
        data: expect.objectContaining({ status: LoanStatus.OVERDUE, updatedById: "user-1" }),
      })
    );
  });

  it("retorna affected: 0 si no hay préstamos vencidos", async () => {
    prismaMock.paymentSchedule.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.loan.updateMany.mockResolvedValue({ count: 0 });

    const result = await processOverdueLoans("user-1");

    expect(result.affected).toBe(0);
  });

  it("actualiza schedule ANTES de los loans (orden correcto)", async () => {
    const callOrder: string[] = [];

    prismaMock.paymentSchedule.updateMany.mockImplementation(async () => {
      callOrder.push("schedule");
      return { count: 2 };
    });
    prismaMock.loan.updateMany.mockImplementation(async () => {
      callOrder.push("loan");
      return { count: 2 };
    });

    await processOverdueLoans("user-1");

    expect(callOrder).toEqual(["schedule", "loan"]);
  });

  it("el resultado refleja el count de loans actualizados (no de schedule)", async () => {
    prismaMock.paymentSchedule.updateMany.mockResolvedValue({ count: 10 });
    prismaMock.loan.updateMany.mockResolvedValue({ count: 7 });

    const result = await processOverdueLoans("user-1");

    // Returns loan count, not schedule count
    expect(result.affected).toBe(7);
  });
});
