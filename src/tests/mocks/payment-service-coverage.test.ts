import { describe, it, expect, vi, beforeEach } from "vitest";
import "./setup";
import {
  calculatePaymentDistribution,
  calculateFlatRateDistribution,
  createPayment,
} from "../../../lib/services/payment.service";
import {
  LoanNotFoundError,
  InvalidPaymentAmountError,
} from "../../../lib/errors";
import { LoanStatus, LoanStructure, PaymentFrequency, PaymentType, ScheduleStatus } from "@prisma/client";
import { prismaMock } from "./prisma.mock";
import { createMockLoan, createMockPayment, createMockFlatRateLoan, createMockSchedule } from "./test-factories";

// ============================================
// HELPERS
// ============================================

/** French loan with payments[] for calculatePaymentDistribution */
function makeFrenchLoanWithPayments(overrides: Record<string, any> = {}) {
  return {
    ...createMockLoan({ annualInterestRate: 24 }),
    loanStructure: LoanStructure.FRENCH_AMORTIZATION,
    payments: [],
    ...overrides,
  };
}

// ============================================
// calculatePaymentDistribution
// Lines 79-116 — full function coverage
// ============================================

describe("calculatePaymentDistribution - French", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lanza LoanNotFoundError si el préstamo no existe", async () => {
    prismaMock.loan.findUnique.mockResolvedValue(null);

    await expect(calculatePaymentDistribution("non-existent", 1000))
      .rejects.toThrow(LoanNotFoundError);
  });

  it("lanza error si el préstamo es FLAT_RATE", async () => {
    const flatLoan = {
      ...createMockFlatRateLoan(),
      payments: [],
    };
    prismaMock.loan.findUnique.mockResolvedValue(flatLoan);

    await expect(calculatePaymentDistribution("loan-flat-1", 300))
      .rejects.toThrow("Use calculateFlatRateDistribution");
  });

  it("calcula distribución básica capital + interés sin mora", async () => {
    // Same-day payment (no late fee since paymentDate <= nextDueDate)
    const loan = makeFrenchLoanWithPayments({
      remainingCapital: 10000,
      annualInterestRate: 24,
      nextDueDate: new Date(Date.now() + 86400000), // mañana — no late fee
      createdAt: new Date(Date.now() - 30 * 86400000), // creado hace 30 días
    });
    prismaMock.loan.findUnique.mockResolvedValue(loan);

    const result = await calculatePaymentDistribution("loan-1", 1000);

    expect(result.totalAmount).toBe(1000);
    expect(result.interestApplied).toBeGreaterThan(0);
    expect(result.capitalApplied).toBeGreaterThan(0);
    expect(result.lateFeeApplied).toBe(0);
  });

  it("incluye mora cuando paymentDate supera nextDueDate", async () => {
    const pastDue = new Date(Date.now() - 10 * 86400000); // vencido hace 10 días
    const loan = makeFrenchLoanWithPayments({
      remainingCapital: 10000,
      annualInterestRate: 24,
      nextDueDate: pastDue,
      createdAt: new Date(Date.now() - 40 * 86400000),
    });
    prismaMock.loan.findUnique.mockResolvedValue(loan);

    const result = await calculatePaymentDistribution("loan-1", 2000);

    expect(result.lateFeeApplied).toBeGreaterThan(0);
  });

  it("usa lastPayment.paymentDate si existe para calcular interés", async () => {
    const lastPaymentDate = new Date(Date.now() - 15 * 86400000);
    const loan = makeFrenchLoanWithPayments({
      remainingCapital: 5000,
      annualInterestRate: 18,
      nextDueDate: new Date(Date.now() + 86400000),
      payments: [{ paymentDate: lastPaymentDate }],
    });
    prismaMock.loan.findUnique.mockResolvedValue(loan);

    const result = await calculatePaymentDistribution("loan-1", 500);

    expect(result.interestApplied).toBeGreaterThan(0);
    expect(result.totalAmount).toBe(500);
  });

  it("capital aplicado no excede el saldo restante", async () => {
    const loan = makeFrenchLoanWithPayments({
      remainingCapital: 100,
      annualInterestRate: 24,
      nextDueDate: new Date(Date.now() + 86400000),
    });
    prismaMock.loan.findUnique.mockResolvedValue(loan);

    const result = await calculatePaymentDistribution("loan-1", 5000);

    // capitalApplied ≤ remainingCapital
    expect(result.capitalApplied).toBeLessThanOrEqual(100);
  });
});

// ============================================
// calculateFlatRateDistribution — no pending entries
// Line 158
// ============================================

describe("calculateFlatRateDistribution - sin cuotas pendientes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lanza error si no hay cuotas pendientes", async () => {
    prismaMock.loan.findUnique.mockResolvedValue(createMockFlatRateLoan());
    prismaMock.paymentSchedule.findMany.mockResolvedValue([]); // no pending entries

    await expect(calculateFlatRateDistribution("loan-flat-1", 300))
      .rejects.toThrow("no tiene cuotas pendientes");
  });
});

// ============================================
// createFrenchPayment — auto-distribution path
// Lines 258-262 (no capitalApplied/interestApplied provided)
// ============================================

describe("createFrenchPayment - distribución automática", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calcula distribución automáticamente cuando no se proveen capital/interés", async () => {
    const mockLoan = createMockLoan({
      loanStructure: LoanStructure.FRENCH_AMORTIZATION,
      remainingCapital: 10000,
      annualInterestRate: 24,
      nextDueDate: new Date(Date.now() + 86400000),
    });
    const mockLoanWithPayments = { ...mockLoan, payments: [] };
    const mockPayment = createMockPayment({ totalAmount: 1000 });
    const updatedLoan = createMockLoan({ remainingCapital: 9000 });

    // Outer createPayment findUnique (French detection)
    // Then calculatePaymentDistribution findUnique (with payments include)
    prismaMock.loan.findUnique
      .mockResolvedValueOnce(mockLoan)            // outer check
      .mockResolvedValueOnce(mockLoanWithPayments); // calculatePaymentDistribution

    prismaMock.$transaction.mockImplementation(async (callback: any) => {
      const txMock = {
        loan: {
          findUnique: vi.fn().mockResolvedValue(mockLoan),
          update: vi.fn().mockResolvedValue(updatedLoan),
        },
        payment: {
          create: vi.fn().mockResolvedValue(mockPayment),
        },
        paymentSchedule: {
          findFirst: vi.fn().mockResolvedValue(null),
          update: vi.fn().mockResolvedValue({}),
        },
      };
      return callback(txMock);
    });

    // Call createPayment WITHOUT capitalApplied/interestApplied
    const result = await createPayment({
      loanId: "loan-1",
      totalAmount: 1000,
      type: PaymentType.REGULAR,
      createdById: "user-1",
    });

    expect(result.payment).toBeDefined();
    // calculatePaymentDistribution was called (second findUnique call)
    expect(prismaMock.loan.findUnique).toHaveBeenCalledTimes(2);
  });
});

// ============================================
// createFrenchPayment — scheduleEntry update when entry exists
// Lines 299-306
// ============================================

describe("createFrenchPayment - actualiza scheduleEntry existente", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marca el schedule entry como PAID cuando existe una cuota pendiente", async () => {
    const mockLoan = createMockLoan({
      loanStructure: LoanStructure.FRENCH_AMORTIZATION,
      remainingCapital: 10000,
    });
    const mockPayment = createMockPayment();
    const updatedLoan = createMockLoan({ remainingCapital: 9200 });
    const existingScheduleEntry = {
      id: "schedule-1",
      loanId: "loan-1",
      installmentNumber: 1,
      status: ScheduleStatus.PENDING,
      dueDate: new Date(),
    };

    prismaMock.loan.findUnique.mockResolvedValue(mockLoan);

    let capturedScheduleUpdate: any;

    prismaMock.$transaction.mockImplementation(async (callback: any) => {
      const txMock = {
        loan: {
          findUnique: vi.fn().mockResolvedValue(mockLoan),
          update: vi.fn().mockResolvedValue(updatedLoan),
        },
        payment: {
          create: vi.fn().mockResolvedValue(mockPayment),
        },
        paymentSchedule: {
          // Returns an existing entry — triggers the update branch
          findFirst: vi.fn().mockResolvedValue(existingScheduleEntry),
          update: vi.fn().mockImplementation((args: any) => {
            capturedScheduleUpdate = args;
            return Promise.resolve({ ...existingScheduleEntry, status: ScheduleStatus.PAID });
          }),
        },
      };
      return callback(txMock);
    });

    await createPayment({
      loanId: "loan-1",
      totalAmount: 1000,
      capitalApplied: 800,
      interestApplied: 200,
      type: PaymentType.REGULAR,
      createdById: "user-1",
    });

    // Verify schedule entry was updated to PAID
    expect(capturedScheduleUpdate).toBeDefined();
    expect(capturedScheduleUpdate.where.id).toBe("schedule-1");
    expect(capturedScheduleUpdate.data.status).toBe(ScheduleStatus.PAID);
  });
});

// ============================================
// createFlatRatePayment — insufficient amount (dist.installmentsCovered === 0)
// Line 363
// ============================================

describe("createFlatRatePayment - monto insuficiente con mora", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lanza InvalidPaymentAmountError cuando pago cubre solo la mora pero no una cuota completa", async () => {
    // 1 cuota vencida → lateFee = 300 × 5% = 15
    // Payment = 15 → cubre la mora pero deja remaining = 0 → 0 cuotas
    // calculateFlatRatePaymentDistribution: installmentsCovered = 0, lateFeeApplied = 15 (> 0)
    // So it returns { installmentsCovered: 0 } without throwing from the pure fn
    // Then createFlatRatePayment sees installmentsCovered === 0 && !isFullSettlement → throws
    const flatLoan = createMockFlatRateLoan({
      id: "loan-flat-late",
      installmentAmount: 300,
      remainingCapital: 13500,
    });

    // Yesterday = overdue
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

    // Outer createPayment findUnique
    prismaMock.loan.findUnique.mockResolvedValue(flatLoan);
    // calculateFlatRateDistribution calls its own findUnique + findMany
    prismaMock.paymentSchedule.findMany.mockResolvedValue(pendingEntries);

    // Payment of exactly 15 (= 1 overdue cuota × 300 × 5% mora)
    // This covers only the late fee, not a full installment
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
