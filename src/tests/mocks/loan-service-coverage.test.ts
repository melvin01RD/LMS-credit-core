import { describe, it, expect, vi, beforeEach } from "vitest";
import "./setup";
import {
  getLoanAmortization,
  getOverdueLoans,
  processOverdueLoans,
} from "../../../lib/services/loan.service";
import { LoanNotFoundError } from "../../../lib/errors";
import { LoanStatus, ScheduleStatus } from "@prisma/client";
import { prismaMock } from "./prisma.mock";
import { createMockFlatRateLoan, createMockSchedule } from "./test-factories";

// ============================================
// getLoanAmortization
// ============================================

describe("getLoanAmortization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lanza LoanNotFoundError si el préstamo no existe", async () => {
    prismaMock.loan.findUnique.mockResolvedValue(null);

    await expect(getLoanAmortization("non-existent")).rejects.toThrow(LoanNotFoundError);
  });

  it("retorna las cuotas del schedule desde DB", async () => {
    const flatLoan = createMockFlatRateLoan();
    const schedule = createMockSchedule("loan-flat-1", 45, 300);

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
// ============================================

describe("getOverdueLoans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna préstamos ACTIVE con nextDueDate anterior a hoy", async () => {
    const overdueLoans = [
      {
        ...createMockFlatRateLoan(),
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

    expect(result.affected).toBe(7);
  });
});
