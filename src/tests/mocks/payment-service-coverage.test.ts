import { describe, it, expect, vi, beforeEach } from "vitest";
import "./setup";
import {
  calculateFlatRateDistribution,
  createPayment,
} from "../../../lib/services/payment.service";
import {
  InvalidPaymentAmountError,
} from "../../../lib/errors";
import { LoanStatus, PaymentFrequency, PaymentType, ScheduleStatus } from "@prisma/client";
import { prismaMock } from "./prisma.mock";
import { createMockPayment, createMockFlatRateLoan, createMockSchedule } from "./test-factories";

// ============================================
// calculateFlatRateDistribution — no pending entries
// ============================================

describe("calculateFlatRateDistribution - sin cuotas pendientes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lanza error si no hay cuotas pendientes", async () => {
    prismaMock.loan.findUnique.mockResolvedValue(createMockFlatRateLoan());
    prismaMock.paymentSchedule.findMany.mockResolvedValue([]);

    await expect(calculateFlatRateDistribution("loan-flat-1", 300))
      .rejects.toThrow("no tiene cuotas pendientes");
  });
});

// ============================================
// createFlatRatePayment — monto insuficiente con mora
// ============================================

describe("createFlatRatePayment - monto insuficiente con mora", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lanza InvalidPaymentAmountError cuando pago cubre solo la mora pero no una cuota completa", async () => {
    const flatLoan = createMockFlatRateLoan({
      id: "loan-flat-late",
      installmentAmount: 300,
      remainingCapital: 13500,
    });

    const yesterday = new Date(Date.now() - 86400000);
    const pendingEntries = [
      {
        id: "schedule-1",
        loanId: "loan-flat-late",
        installmentNumber: 1,
        dueDate: yesterday,
        expectedAmount: 300,
        status: ScheduleStatus.OVERDUE,
      },
      {
        id: "schedule-2",
        loanId: "loan-flat-late",
        installmentNumber: 2,
        dueDate: new Date(Date.now() + 86400000),
        expectedAmount: 300,
        status: ScheduleStatus.PENDING,
      },
    ];

    prismaMock.loan.findUnique.mockResolvedValue(flatLoan);
    prismaMock.paymentSchedule.findMany.mockResolvedValue(pendingEntries);

    await expect(
      createPayment({
        loanId: "loan-flat-late",
        totalAmount: 15,
        type: PaymentType.REGULAR,
        createdById: "user-1",
      })
    ).rejects.toThrow(InvalidPaymentAmountError);
  });
});
