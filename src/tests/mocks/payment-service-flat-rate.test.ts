import { describe, it, expect, vi, beforeEach } from "vitest";
import "./setup";
import { createPayment, reversePayment } from "../../../lib/services/payment.service";
import {
  LoanNotFoundError,
  PaymentNotAllowedError,
  InvalidPaymentAmountError,
} from "../../../lib/errors";
import { LoanStatus, PaymentType, ScheduleStatus } from "@prisma/client";
import { prismaMock } from "./prisma.mock";
import {
  createMockFlatRateLoan,
  createMockPayment,
  createMockSchedule,
  createMockClient,
} from "./test-factories";

// ============================================
// Helpers
// ============================================

/**
 * Sets up all mocks needed for createPayment on a FLAT_RATE loan.
 *
 * Flow:
 *  1. prisma.loan.findUnique   → loan (in createPayment)
 *  2. prisma.loan.findUnique   → loan (in calculateFlatRateDistribution)
 *  3. prisma.paymentSchedule.findMany → pendingEntries (in calculateFlatRateDistribution)
 *  4. prisma.$transaction      → payment.create, paymentSchedule.updateMany,
 *                                paymentSchedule.findFirst, loan.update
 */
function setupFlatRatePaymentMocks(params: {
  loan: ReturnType<typeof createMockFlatRateLoan>;
  pendingEntries: ReturnType<typeof createMockSchedule>;
  payment: ReturnType<typeof createMockPayment>;
  updatedLoan: ReturnType<typeof createMockFlatRateLoan>;
  nextPendingEntry?: ReturnType<typeof createMockSchedule>[number] | null;
}) {
  const { loan, pendingEntries, payment, updatedLoan, nextPendingEntry = null } = params;

  // Called twice: once in createPayment, once inside calculateFlatRateDistribution
  prismaMock.loan.findUnique.mockResolvedValue(loan);
  prismaMock.paymentSchedule.findMany.mockResolvedValue(pendingEntries);

  prismaMock.$transaction.mockImplementation(async (callback: any) => {
    const txMock = {
      payment: {
        create: vi.fn().mockResolvedValue(payment),
      },
      paymentSchedule: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirst: vi.fn().mockResolvedValue(nextPendingEntry),
      },
      loan: {
        update: vi.fn().mockResolvedValue({ ...updatedLoan, client: createMockClient() }),
      },
    };
    return callback(txMock);
  });
}

// ============================================
// createPayment - FLAT_RATE - pago regular (1 cuota)
// ============================================

describe("createPayment - FLAT_RATE - pago regular", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("pago exacto de una cuota marca 1 schedule entry como PAID", async () => {
    const loan = createMockFlatRateLoan();
    const pendingEntries = createMockSchedule("loan-flat-1", 45, 300, new Date());
    const payment = { ...createMockPayment({ totalAmount: 300, installmentsCovered: 1 }), loanId: "loan-flat-1" };
    const updatedLoan = createMockFlatRateLoan({ installmentsPaid: 1, remainingCapital: 13200 });

    let capturedUpdateMany: any;
    prismaMock.loan.findUnique.mockResolvedValue(loan);
    prismaMock.paymentSchedule.findMany.mockResolvedValue(pendingEntries);
    prismaMock.$transaction.mockImplementation(async (callback: any) => {
      const txMock = {
        payment: { create: vi.fn().mockResolvedValue(payment) },
        paymentSchedule: {
          updateMany: vi.fn().mockImplementation((args: any) => {
            capturedUpdateMany = args;
            return Promise.resolve({ count: 1 });
          }),
          findFirst: vi.fn().mockResolvedValue(pendingEntries[1]),
        },
        loan: {
          update: vi.fn().mockResolvedValue({ ...updatedLoan, client: createMockClient() }),
        },
      };
      return callback(txMock);
    });

    await createPayment({
      loanId: "loan-flat-1",
      totalAmount: 300,
      type: PaymentType.REGULAR,
      createdById: "user-1",
    });

    // Should mark exactly 1 schedule entry
    expect(capturedUpdateMany.where.id.in).toHaveLength(1);
    expect(capturedUpdateMany.data.status).toBe(ScheduleStatus.PAID);
  });

  it("incrementa installmentsPaid en 1", async () => {
    const loan = createMockFlatRateLoan({ installmentsPaid: 0 });
    const pendingEntries = createMockSchedule("loan-flat-1", 45, 300, new Date());
    const payment = { ...createMockPayment({ totalAmount: 300 }), loanId: "loan-flat-1" };
    const updatedLoan = createMockFlatRateLoan({ installmentsPaid: 1 });

    let capturedLoanUpdate: any;
    prismaMock.loan.findUnique.mockResolvedValue(loan);
    prismaMock.paymentSchedule.findMany.mockResolvedValue(pendingEntries);
    prismaMock.$transaction.mockImplementation(async (callback: any) => {
      const txMock = {
        payment: { create: vi.fn().mockResolvedValue(payment) },
        paymentSchedule: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findFirst: vi.fn().mockResolvedValue(pendingEntries[1]),
        },
        loan: {
          update: vi.fn().mockImplementation((args: any) => {
            capturedLoanUpdate = args;
            return Promise.resolve({ ...updatedLoan, client: createMockClient() });
          }),
        },
      };
      return callback(txMock);
    });

    await createPayment({
      loanId: "loan-flat-1",
      totalAmount: 300,
      type: PaymentType.REGULAR,
      createdById: "user-1",
    });

    expect(capturedLoanUpdate.data.installmentsPaid).toBe(1);
  });

  it("registra el payment con installmentsCovered: 1", async () => {
    const loan = createMockFlatRateLoan();
    const pendingEntries = createMockSchedule("loan-flat-1", 45, 300, new Date());
    const payment = { ...createMockPayment({ totalAmount: 300, installmentsCovered: 1 }), loanId: "loan-flat-1" };
    const updatedLoan = createMockFlatRateLoan({ installmentsPaid: 1 });

    let capturedPaymentCreate: any;
    prismaMock.loan.findUnique.mockResolvedValue(loan);
    prismaMock.paymentSchedule.findMany.mockResolvedValue(pendingEntries);
    prismaMock.$transaction.mockImplementation(async (callback: any) => {
      const txMock = {
        payment: {
          create: vi.fn().mockImplementation((args: any) => {
            capturedPaymentCreate = args;
            return Promise.resolve(payment);
          }),
        },
        paymentSchedule: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findFirst: vi.fn().mockResolvedValue(pendingEntries[1]),
        },
        loan: {
          update: vi.fn().mockResolvedValue({ ...updatedLoan, client: createMockClient() }),
        },
      };
      return callback(txMock);
    });

    await createPayment({
      loanId: "loan-flat-1",
      totalAmount: 300,
      type: PaymentType.REGULAR,
      createdById: "user-1",
    });

    expect(capturedPaymentCreate.data.installmentsCovered).toBe(1);
  });

  it("capitalApplied e interestApplied son proporcionales al número de cuotas cubiertas", async () => {
    const loan = createMockFlatRateLoan();
    const pendingEntries = createMockSchedule("loan-flat-1", 45, 300, new Date());
    const payment = { ...createMockPayment({ totalAmount: 300 }), loanId: "loan-flat-1" };
    const updatedLoan = createMockFlatRateLoan({ installmentsPaid: 1 });

    let capturedPaymentCreate: any;
    prismaMock.loan.findUnique.mockResolvedValue(loan);
    prismaMock.paymentSchedule.findMany.mockResolvedValue(pendingEntries);
    prismaMock.$transaction.mockImplementation(async (callback: any) => {
      const txMock = {
        payment: {
          create: vi.fn().mockImplementation((args: any) => {
            capturedPaymentCreate = args;
            return Promise.resolve(payment);
          }),
        },
        paymentSchedule: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findFirst: vi.fn().mockResolvedValue(pendingEntries[1]),
        },
        loan: {
          update: vi.fn().mockResolvedValue({ ...updatedLoan, client: createMockClient() }),
        },
      };
      return callback(txMock);
    });

    await createPayment({
      loanId: "loan-flat-1",
      totalAmount: 300,
      type: PaymentType.REGULAR,
      createdById: "user-1",
    });

    // capital per installment = 10000 / 45 ≈ 222.22
    // interest per installment = 3500 / 45 ≈ 77.78
    const expectedCapital  = Math.round((10000 / 45) * 100) / 100;
    const expectedInterest = Math.round((3500  / 45) * 100) / 100;
    expect(capturedPaymentCreate.data.capitalApplied).toBeCloseTo(expectedCapital,  1);
    expect(capturedPaymentCreate.data.interestApplied).toBeCloseTo(expectedInterest, 1);
  });
});

// ============================================
// createPayment - FLAT_RATE - cuotas adelantadas (ADVANCE)
// ============================================

describe("createPayment - FLAT_RATE - cuotas adelantadas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("pago de 2 cuotas marca 2 schedule entries como PAID", async () => {
    const loan = createMockFlatRateLoan();
    const pendingEntries = createMockSchedule("loan-flat-1", 45, 300, new Date());
    const payment = { ...createMockPayment({ totalAmount: 600, installmentsCovered: 2 }), loanId: "loan-flat-1" };
    const updatedLoan = createMockFlatRateLoan({ installmentsPaid: 2 });

    let capturedUpdateMany: any;
    prismaMock.loan.findUnique.mockResolvedValue(loan);
    prismaMock.paymentSchedule.findMany.mockResolvedValue(pendingEntries);
    prismaMock.$transaction.mockImplementation(async (callback: any) => {
      const txMock = {
        payment: { create: vi.fn().mockResolvedValue(payment) },
        paymentSchedule: {
          updateMany: vi.fn().mockImplementation((args: any) => {
            capturedUpdateMany = args;
            return Promise.resolve({ count: 2 });
          }),
          findFirst: vi.fn().mockResolvedValue(pendingEntries[2]),
        },
        loan: {
          update: vi.fn().mockResolvedValue({ ...updatedLoan, client: createMockClient() }),
        },
      };
      return callback(txMock);
    });

    await createPayment({
      loanId: "loan-flat-1",
      totalAmount: 600,
      type: PaymentType.ADVANCE,
      createdById: "user-1",
    });

    expect(capturedUpdateMany.where.id.in).toHaveLength(2);
  });

  it("tipo de pago se establece como ADVANCE automáticamente para 2+ cuotas", async () => {
    const loan = createMockFlatRateLoan();
    const pendingEntries = createMockSchedule("loan-flat-1", 45, 300, new Date());
    const payment = { ...createMockPayment({ totalAmount: 600 }), loanId: "loan-flat-1" };
    const updatedLoan = createMockFlatRateLoan({ installmentsPaid: 2 });

    let capturedPaymentCreate: any;
    prismaMock.loan.findUnique.mockResolvedValue(loan);
    prismaMock.paymentSchedule.findMany.mockResolvedValue(pendingEntries);
    prismaMock.$transaction.mockImplementation(async (callback: any) => {
      const txMock = {
        payment: {
          create: vi.fn().mockImplementation((args: any) => {
            capturedPaymentCreate = args;
            return Promise.resolve(payment);
          }),
        },
        paymentSchedule: {
          updateMany: vi.fn().mockResolvedValue({ count: 2 }),
          findFirst: vi.fn().mockResolvedValue(pendingEntries[2]),
        },
        loan: {
          update: vi.fn().mockResolvedValue({ ...updatedLoan, client: createMockClient() }),
        },
      };
      return callback(txMock);
    });

    await createPayment({
      loanId: "loan-flat-1",
      totalAmount: 600,
      type: PaymentType.ADVANCE,
      createdById: "user-1",
    });

    expect(capturedPaymentCreate.data.type).toBe(PaymentType.ADVANCE);
  });

  it("installmentsPaid incrementa en la cantidad de cuotas cubiertas", async () => {
    const loan = createMockFlatRateLoan({ installmentsPaid: 5 });
    const pendingEntries = createMockSchedule("loan-flat-1", 40, 300, new Date());
    const payment = { ...createMockPayment({ totalAmount: 600 }), loanId: "loan-flat-1" };
    const updatedLoan = createMockFlatRateLoan({ installmentsPaid: 7 });

    let capturedLoanUpdate: any;
    prismaMock.loan.findUnique.mockResolvedValue(loan);
    prismaMock.paymentSchedule.findMany.mockResolvedValue(pendingEntries);
    prismaMock.$transaction.mockImplementation(async (callback: any) => {
      const txMock = {
        payment: { create: vi.fn().mockResolvedValue(payment) },
        paymentSchedule: {
          updateMany: vi.fn().mockResolvedValue({ count: 2 }),
          findFirst: vi.fn().mockResolvedValue(pendingEntries[2]),
        },
        loan: {
          update: vi.fn().mockImplementation((args: any) => {
            capturedLoanUpdate = args;
            return Promise.resolve({ ...updatedLoan, client: createMockClient() });
          }),
        },
      };
      return callback(txMock);
    });

    await createPayment({
      loanId: "loan-flat-1",
      totalAmount: 600,
      type: PaymentType.ADVANCE,
      createdById: "user-1",
    });

    // was 5, covers 2 → 7
    expect(capturedLoanUpdate.data.installmentsPaid).toBe(7);
  });

  it("cargo sagrado: pago adelantado NO cambia totalFinanceCharge del préstamo", async () => {
    const loan = createMockFlatRateLoan({ totalFinanceCharge: 3500 });
    const pendingEntries = createMockSchedule("loan-flat-1", 45, 300, new Date());
    const payment = { ...createMockPayment({ totalAmount: 600 }), loanId: "loan-flat-1" };
    const updatedLoan = createMockFlatRateLoan({ installmentsPaid: 2, totalFinanceCharge: 3500 });

    let capturedLoanUpdate: any;
    prismaMock.loan.findUnique.mockResolvedValue(loan);
    prismaMock.paymentSchedule.findMany.mockResolvedValue(pendingEntries);
    prismaMock.$transaction.mockImplementation(async (callback: any) => {
      const txMock = {
        payment: { create: vi.fn().mockResolvedValue(payment) },
        paymentSchedule: {
          updateMany: vi.fn().mockResolvedValue({ count: 2 }),
          findFirst: vi.fn().mockResolvedValue(pendingEntries[2]),
        },
        loan: {
          update: vi.fn().mockImplementation((args: any) => {
            capturedLoanUpdate = args;
            return Promise.resolve({ ...updatedLoan, client: createMockClient() });
          }),
        },
      };
      return callback(txMock);
    });

    await createPayment({
      loanId: "loan-flat-1",
      totalAmount: 600,
      type: PaymentType.ADVANCE,
      createdById: "user-1",
    });

    // The loan update does NOT include totalFinanceCharge — it stays unchanged
    expect(capturedLoanUpdate.data.totalFinanceCharge).toBeUndefined();
  });
});

// ============================================
// createPayment - FLAT_RATE - liquidación total
// ============================================

describe("createPayment - FLAT_RATE - liquidación total", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("préstamo queda PAID cuando se pagan todas las cuotas", async () => {
    // Loan with 5 remaining installments
    const loan = createMockFlatRateLoan({ termCount: 5, installmentsPaid: 0, totalPayableAmount: 1500, remainingCapital: 1500 });
    const pendingEntries = createMockSchedule("loan-flat-1", 5, 300, new Date());
    const payment = { ...createMockPayment({ totalAmount: 1500, installmentsCovered: 5 }), loanId: "loan-flat-1" };
    const updatedLoan = createMockFlatRateLoan({ termCount: 5, installmentsPaid: 5, remainingCapital: 0, status: LoanStatus.PAID, nextDueDate: null });

    let capturedLoanUpdate: any;
    prismaMock.loan.findUnique.mockResolvedValue(loan);
    prismaMock.paymentSchedule.findMany.mockResolvedValue(pendingEntries);
    prismaMock.$transaction.mockImplementation(async (callback: any) => {
      const txMock = {
        payment: { create: vi.fn().mockResolvedValue(payment) },
        paymentSchedule: {
          updateMany: vi.fn().mockResolvedValue({ count: 5 }),
          findFirst: vi.fn().mockResolvedValue(null), // no more pending
        },
        loan: {
          update: vi.fn().mockImplementation((args: any) => {
            capturedLoanUpdate = args;
            return Promise.resolve({ ...updatedLoan, client: createMockClient() });
          }),
        },
      };
      return callback(txMock);
    });

    const result = await createPayment({
      loanId: "loan-flat-1",
      totalAmount: 1500,
      type: PaymentType.FULL_SETTLEMENT,
      createdById: "user-1",
    });

    expect(capturedLoanUpdate.data.status).toBe(LoanStatus.PAID);
    expect(capturedLoanUpdate.data.nextDueDate).toBeNull();
    expect(result.statusChanged).toBe(true);
  });

  it("installmentsPaid === termCount al liquidar", async () => {
    const loan = createMockFlatRateLoan({ termCount: 5, installmentsPaid: 0, totalPayableAmount: 1500, remainingCapital: 1500 });
    const pendingEntries = createMockSchedule("loan-flat-1", 5, 300, new Date());
    const payment = { ...createMockPayment({ totalAmount: 1500 }), loanId: "loan-flat-1" };
    const updatedLoan = createMockFlatRateLoan({ termCount: 5, installmentsPaid: 5, status: LoanStatus.PAID });

    let capturedLoanUpdate: any;
    prismaMock.loan.findUnique.mockResolvedValue(loan);
    prismaMock.paymentSchedule.findMany.mockResolvedValue(pendingEntries);
    prismaMock.$transaction.mockImplementation(async (callback: any) => {
      const txMock = {
        payment: { create: vi.fn().mockResolvedValue(payment) },
        paymentSchedule: {
          updateMany: vi.fn().mockResolvedValue({ count: 5 }),
          findFirst: vi.fn().mockResolvedValue(null),
        },
        loan: {
          update: vi.fn().mockImplementation((args: any) => {
            capturedLoanUpdate = args;
            return Promise.resolve({ ...updatedLoan, client: createMockClient() });
          }),
        },
      };
      return callback(txMock);
    });

    await createPayment({
      loanId: "loan-flat-1",
      totalAmount: 1500,
      type: PaymentType.FULL_SETTLEMENT,
      createdById: "user-1",
    });

    expect(capturedLoanUpdate.data.installmentsPaid).toBe(5);
  });

  it("remainingCapital queda en 0 al liquidar", async () => {
    const loan = createMockFlatRateLoan({ termCount: 5, installmentsPaid: 0, totalPayableAmount: 1500, remainingCapital: 1500 });
    const pendingEntries = createMockSchedule("loan-flat-1", 5, 300, new Date());
    const payment = { ...createMockPayment({ totalAmount: 1500 }), loanId: "loan-flat-1" };
    const updatedLoan = createMockFlatRateLoan({ termCount: 5, installmentsPaid: 5, remainingCapital: 0, status: LoanStatus.PAID });

    let capturedLoanUpdate: any;
    prismaMock.loan.findUnique.mockResolvedValue(loan);
    prismaMock.paymentSchedule.findMany.mockResolvedValue(pendingEntries);
    prismaMock.$transaction.mockImplementation(async (callback: any) => {
      const txMock = {
        payment: { create: vi.fn().mockResolvedValue(payment) },
        paymentSchedule: {
          updateMany: vi.fn().mockResolvedValue({ count: 5 }),
          findFirst: vi.fn().mockResolvedValue(null),
        },
        loan: {
          update: vi.fn().mockImplementation((args: any) => {
            capturedLoanUpdate = args;
            return Promise.resolve({ ...updatedLoan, client: createMockClient() });
          }),
        },
      };
      return callback(txMock);
    });

    await createPayment({
      loanId: "loan-flat-1",
      totalAmount: 1500,
      type: PaymentType.FULL_SETTLEMENT,
      createdById: "user-1",
    });

    expect(capturedLoanUpdate.data.remainingCapital).toBe(0);
  });
});

// ============================================
// createPayment - FLAT_RATE - validaciones y errores
// ============================================

describe("createPayment - FLAT_RATE - errores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lanza LoanNotFoundError si el préstamo no existe", async () => {
    prismaMock.loan.findUnique.mockResolvedValue(null);

    await expect(
      createPayment({
        loanId: "non-existent",
        totalAmount: 300,
        type: PaymentType.REGULAR,
        createdById: "user-1",
      })
    ).rejects.toThrow(LoanNotFoundError);
  });

  it("lanza PaymentNotAllowedError si el préstamo está PAID", async () => {
    const paidLoan = createMockFlatRateLoan({ status: LoanStatus.PAID });
    prismaMock.loan.findUnique.mockResolvedValue(paidLoan);

    await expect(
      createPayment({
        loanId: "loan-flat-1",
        totalAmount: 300,
        type: PaymentType.REGULAR,
        createdById: "user-1",
      })
    ).rejects.toThrow(PaymentNotAllowedError);
  });

  it("lanza PaymentNotAllowedError si el préstamo está CANCELED", async () => {
    const canceledLoan = createMockFlatRateLoan({ status: LoanStatus.CANCELED });
    prismaMock.loan.findUnique.mockResolvedValue(canceledLoan);

    await expect(
      createPayment({
        loanId: "loan-flat-1",
        totalAmount: 300,
        type: PaymentType.REGULAR,
        createdById: "user-1",
      })
    ).rejects.toThrow(PaymentNotAllowedError);
  });

  it("lanza error si el pago es insuficiente para cubrir una cuota", async () => {
    const loan = createMockFlatRateLoan({ installmentAmount: 300 });
    const pendingEntries = createMockSchedule("loan-flat-1", 45, 300, new Date());

    prismaMock.loan.findUnique.mockResolvedValue(loan);
    prismaMock.paymentSchedule.findMany.mockResolvedValue(pendingEntries);

    // The error is thrown by calculateFlatRatePaymentDistribution (pure function)
    // before the service wrapper can convert it to InvalidPaymentAmountError
    await expect(
      createPayment({
        loanId: "loan-flat-1",
        totalAmount: 100, // less than 300
        type: PaymentType.REGULAR,
        createdById: "user-1",
      })
    ).rejects.toThrow("es insuficiente para cubrir una cuota");
  });
});

// ============================================
// reversePayment - FLAT_RATE
// ============================================

describe("reversePayment - FLAT_RATE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupFlatRateReversal(params: {
    originalLoan: ReturnType<typeof createMockFlatRateLoan>;
    originalPaymentOverrides?: object;
    updatedLoan: ReturnType<typeof createMockFlatRateLoan>;
    nextPending?: object | null;
  }) {
    const { originalLoan, originalPaymentOverrides = {}, updatedLoan, nextPending = null } = params;

    const originalPayment = {
      ...createMockPayment({
        totalAmount: 300,
        capitalApplied: 222.22,
        interestApplied: 77.78,
        installmentsCovered: 1,
        ...originalPaymentOverrides,
      }),
      loanId: "loan-flat-1",
      loan: originalLoan,
    };

    const reversalPayment = {
      ...createMockPayment({
        id: "reversal-1",
        totalAmount: -300,
        capitalApplied: -222.22,
        interestApplied: -77.78,
        installmentsCovered: -1,
      }),
      loanId: "loan-flat-1",
    };

    prismaMock.$transaction.mockImplementation(async (callback: any) => {
      const txMock = {
        payment: {
          findUnique: vi.fn().mockResolvedValue(originalPayment),
          create: vi.fn().mockResolvedValue(reversalPayment),
        },
        paymentSchedule: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findFirst: vi.fn().mockResolvedValue(nextPending),
        },
        loan: {
          update: vi.fn().mockResolvedValue({ ...updatedLoan, client: createMockClient() }),
        },
      };
      return callback(txMock);
    });
  }

  it("revierte las cuotas del schedule a status PENDING", async () => {
    const originalLoan = createMockFlatRateLoan({ installmentsPaid: 1 });
    const updatedLoan = createMockFlatRateLoan({ installmentsPaid: 0 });

    let capturedScheduleUpdate: any;
    const originalPayment = {
      ...createMockPayment({ totalAmount: 300, capitalApplied: 222.22, interestApplied: 77.78, installmentsCovered: 1 }),
      loanId: "loan-flat-1",
      loan: originalLoan,
    };
    const reversalPayment = createMockPayment({ id: "reversal-1", totalAmount: -300 });

    prismaMock.$transaction.mockImplementation(async (callback: any) => {
      const txMock = {
        payment: {
          findUnique: vi.fn().mockResolvedValue(originalPayment),
          create: vi.fn().mockResolvedValue(reversalPayment),
        },
        paymentSchedule: {
          updateMany: vi.fn().mockImplementation((args: any) => {
            capturedScheduleUpdate = args;
            return Promise.resolve({ count: 1 });
          }),
          findFirst: vi.fn().mockResolvedValue(null),
        },
        loan: {
          update: vi.fn().mockResolvedValue({ ...updatedLoan, client: createMockClient() }),
        },
      };
      return callback(txMock);
    });

    await reversePayment("payment-1", "user-1", "Error en el pago");

    expect(capturedScheduleUpdate.data.status).toBe(ScheduleStatus.PENDING);
    expect(capturedScheduleUpdate.data.paidAt).toBeNull();
  });

  it("decrece installmentsPaid en la cantidad revertida", async () => {
    const originalLoan = createMockFlatRateLoan({ installmentsPaid: 5 });
    const updatedLoan = createMockFlatRateLoan({ installmentsPaid: 3 });

    const originalPayment = {
      ...createMockPayment({ totalAmount: 600, capitalApplied: 444.44, interestApplied: 155.56, installmentsCovered: 2 }),
      loanId: "loan-flat-1",
      loan: originalLoan,
    };
    const reversalPayment = createMockPayment({ id: "reversal-1", totalAmount: -600 });

    let capturedLoanUpdate: any;
    prismaMock.$transaction.mockImplementation(async (callback: any) => {
      const txMock = {
        payment: {
          findUnique: vi.fn().mockResolvedValue(originalPayment),
          create: vi.fn().mockResolvedValue(reversalPayment),
        },
        paymentSchedule: {
          updateMany: vi.fn().mockResolvedValue({ count: 2 }),
          findFirst: vi.fn().mockResolvedValue(null),
        },
        loan: {
          update: vi.fn().mockImplementation((args: any) => {
            capturedLoanUpdate = args;
            return Promise.resolve({ ...updatedLoan, client: createMockClient() });
          }),
        },
      };
      return callback(txMock);
    });

    await reversePayment("payment-1", "user-1", "Reversal");

    // 5 - 2 = 3
    expect(capturedLoanUpdate.data.installmentsPaid).toBe(3);
  });

  it("si el préstamo estaba PAID, vuelve a ACTIVE después del reversal", async () => {
    const originalLoan = createMockFlatRateLoan({ status: LoanStatus.PAID, installmentsPaid: 45, remainingCapital: 0 });
    const updatedLoan = createMockFlatRateLoan({ status: LoanStatus.ACTIVE, installmentsPaid: 44 });
    const nextPendingEntry = { id: "schedule-45", installmentNumber: 45, dueDate: new Date(Date.now() + 86400000) };

    const originalPayment = {
      ...createMockPayment({ totalAmount: 300, capitalApplied: 222.22, interestApplied: 77.78, installmentsCovered: 1 }),
      loanId: "loan-flat-1",
      loan: originalLoan,
    };
    const reversalPayment = createMockPayment({ id: "reversal-1", totalAmount: -300 });

    let capturedLoanUpdate: any;
    prismaMock.$transaction.mockImplementation(async (callback: any) => {
      const txMock = {
        payment: {
          findUnique: vi.fn().mockResolvedValue(originalPayment),
          create: vi.fn().mockResolvedValue(reversalPayment),
        },
        paymentSchedule: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findFirst: vi.fn().mockResolvedValue(nextPendingEntry),
        },
        loan: {
          update: vi.fn().mockImplementation((args: any) => {
            capturedLoanUpdate = args;
            return Promise.resolve({ ...updatedLoan, client: createMockClient() });
          }),
        },
      };
      return callback(txMock);
    });

    const result = await reversePayment("payment-1", "user-1", "Reversal");

    expect(capturedLoanUpdate.data.status).toBe(LoanStatus.ACTIVE);
    expect(result.statusChanged).toBe(true);
  });

  it("nextDueDate se recalcula a la primera cuota pendiente después del reversal", async () => {
    const nextDue = new Date(Date.now() + 86400000);
    const originalLoan = createMockFlatRateLoan({ installmentsPaid: 3 });
    const updatedLoan = createMockFlatRateLoan({ installmentsPaid: 2 });
    const nextPendingEntry = { id: "schedule-3", installmentNumber: 3, dueDate: nextDue };

    const originalPayment = {
      ...createMockPayment({ totalAmount: 300, installmentsCovered: 1 }),
      loanId: "loan-flat-1",
      loan: originalLoan,
    };
    const reversalPayment = createMockPayment({ id: "reversal-1", totalAmount: -300 });

    let capturedLoanUpdate: any;
    prismaMock.$transaction.mockImplementation(async (callback: any) => {
      const txMock = {
        payment: {
          findUnique: vi.fn().mockResolvedValue(originalPayment),
          create: vi.fn().mockResolvedValue(reversalPayment),
        },
        paymentSchedule: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findFirst: vi.fn().mockResolvedValue(nextPendingEntry),
        },
        loan: {
          update: vi.fn().mockImplementation((args: any) => {
            capturedLoanUpdate = args;
            return Promise.resolve({ ...updatedLoan, client: createMockClient() });
          }),
        },
      };
      return callback(txMock);
    });

    await reversePayment("payment-1", "user-1", "Reversal");

    expect(capturedLoanUpdate.data.nextDueDate).toEqual(nextDue);
  });
});
