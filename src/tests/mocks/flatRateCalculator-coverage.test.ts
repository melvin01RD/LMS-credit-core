import { describe, it, expect } from "vitest";
import { PaymentFrequency } from "@prisma/client";
import {
  calculateFlatRateNextDate,
  calculateFlatRatePaymentDistribution,
  calculateFlatRateOverdueInfo,
  getLoanStructureTexts,
} from "../../../lib/domain/flatRateCalculator";

// ============================================
// calculateFlatRateNextDate — BIWEEKLY, MONTHLY, default error
// Lines 153-158
// ============================================

describe("calculateFlatRateNextDate - frecuencias adicionales", () => {
  it("BIWEEKLY avanza 14 días por cuota", () => {
    const start = new Date("2026-01-01");
    const result = calculateFlatRateNextDate(start, PaymentFrequency.BIWEEKLY, 1);
    const expected = new Date("2026-01-15");
    expect(result.toDateString()).toBe(expected.toDateString());
  });

  it("BIWEEKLY cuota 2 avanza 28 días desde inicio", () => {
    const start = new Date("2026-01-01");
    const result = calculateFlatRateNextDate(start, PaymentFrequency.BIWEEKLY, 2);
    const expected = new Date("2026-01-29");
    expect(result.toDateString()).toBe(expected.toDateString());
  });

  it("MONTHLY avanza 1 mes por cuota", () => {
    const start = new Date("2026-01-01");
    const result = calculateFlatRateNextDate(start, PaymentFrequency.MONTHLY, 1);
    const expected = new Date("2026-02-01");
    expect(result.toDateString()).toBe(expected.toDateString());
  });

  it("MONTHLY cuota 3 avanza 3 meses desde inicio", () => {
    const start = new Date("2026-01-01");
    const result = calculateFlatRateNextDate(start, PaymentFrequency.MONTHLY, 3);
    const expected = new Date("2026-04-01");
    expect(result.toDateString()).toBe(expected.toDateString());
  });

  it("lanza error para frecuencia no soportada", () => {
    const start = new Date("2026-01-01");
    expect(() => calculateFlatRateNextDate(start, "INVALID" as any, 1)).toThrow(
      "Frecuencia no soportada"
    );
  });
});

// ============================================
// calculateFlatRatePaymentDistribution — paymentAmount <= 0
// Line 182
// ============================================

describe("calculateFlatRatePaymentDistribution - validación monto", () => {
  it("lanza error cuando paymentAmount es 0", () => {
    expect(() =>
      calculateFlatRatePaymentDistribution({
        paymentAmount: 0,
        installmentAmount: 300,
        pendingInstallments: 5,
        overdueInstallments: 0,
      })
    ).toThrow("El monto del pago debe ser mayor a cero");
  });

  it("lanza error cuando paymentAmount es negativo", () => {
    expect(() =>
      calculateFlatRatePaymentDistribution({
        paymentAmount: -100,
        installmentAmount: 300,
        pendingInstallments: 5,
        overdueInstallments: 0,
      })
    ).toThrow("El monto del pago debe ser mayor a cero");
  });
});

// ============================================
// calculateFlatRateOverdueInfo
// Lines 251-270
// ============================================

describe("calculateFlatRateOverdueInfo", () => {
  it("retorna daysOverdue=0 cuando no hay cuotas vencidas", () => {
    const tomorrow = new Date(Date.now() + 86400000);
    const entries = [
      { installmentNumber: 1, dueDate: tomorrow, status: "PENDING", expectedAmount: 300 },
      { installmentNumber: 2, dueDate: new Date(Date.now() + 2 * 86400000), status: "PENDING", expectedAmount: 300 },
    ];
    const result = calculateFlatRateOverdueInfo({ scheduleEntries: entries });
    expect(result.overdueInstallments).toBe(0);
    expect(result.overdueAmount).toBe(0);
    expect(result.lateFee).toBe(0);
    expect(result.daysOverdue).toBe(0);
  });

  it("detecta cuotas vencidas correctamente", () => {
    const yesterday = new Date(Date.now() - 86400000);
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000);
    const entries = [
      { installmentNumber: 1, dueDate: twoDaysAgo, status: "PENDING", expectedAmount: 300 },
      { installmentNumber: 2, dueDate: yesterday, status: "PENDING", expectedAmount: 300 },
      { installmentNumber: 3, dueDate: new Date(Date.now() + 86400000), status: "PENDING", expectedAmount: 300 },
    ];
    const result = calculateFlatRateOverdueInfo({ scheduleEntries: entries });
    expect(result.overdueInstallments).toBe(2);
    expect(result.overdueAmount).toBe(600);
    expect(result.lateFee).toBeGreaterThan(0);
  });

  it("no cuenta cuotas PAID como vencidas aunque su fecha haya pasado", () => {
    const yesterday = new Date(Date.now() - 86400000);
    const entries = [
      { installmentNumber: 1, dueDate: yesterday, status: "PAID", expectedAmount: 300 },
      { installmentNumber: 2, dueDate: yesterday, status: "PENDING", expectedAmount: 300 },
    ];
    const result = calculateFlatRateOverdueInfo({ scheduleEntries: entries });
    expect(result.overdueInstallments).toBe(1);
  });

  it("calcula daysOverdue desde la primera cuota vencida con today fijo", () => {
    // Use local date constructor to avoid UTC-parsing timezone shift
    const fixedToday = new Date(2026, 2, 1); // March 1, 2026 local
    fixedToday.setHours(0, 0, 0, 0);
    const pastDate = new Date(2026, 1, 24); // Feb 24, 2026 local
    pastDate.setHours(0, 0, 0, 0);
    const entries = [
      { installmentNumber: 1, dueDate: pastDate, status: "PENDING", expectedAmount: 300 },
    ];
    const result = calculateFlatRateOverdueInfo({ scheduleEntries: entries, today: fixedToday });
    expect(result.overdueInstallments).toBe(1);
    expect(result.daysOverdue).toBe(5);
  });

  it("acepta fecha 'today' como parámetro para testing determinístico", () => {
    // Use local date constructor to avoid UTC-parsing timezone shift
    const fixedToday = new Date(2026, 2, 10); // March 10, 2026 local
    fixedToday.setHours(0, 0, 0, 0);
    const date1 = new Date(2026, 2, 7); // March 7 local
    date1.setHours(0, 0, 0, 0);
    const date2 = new Date(2026, 2, 8); // March 8 local
    date2.setHours(0, 0, 0, 0);
    const entries = [
      { installmentNumber: 1, dueDate: date1, status: "PENDING", expectedAmount: 300 },
      { installmentNumber: 2, dueDate: date2, status: "PENDING", expectedAmount: 300 },
    ];
    const result = calculateFlatRateOverdueInfo({ scheduleEntries: entries, today: fixedToday });
    expect(result.overdueInstallments).toBe(2);
    expect(result.daysOverdue).toBe(3); // 10 - 7 = 3 from first overdue
    expect(result.overdueAmount).toBeCloseTo(600, 1);
  });
});

// ============================================
// getLoanStructureTexts
// Lines 333-362
// ============================================

describe("getLoanStructureTexts", () => {
  it("FLAT_RATE retorna 'Cargo Financiero' como interestLabel", () => {
    const texts = getLoanStructureTexts("FLAT_RATE");
    expect(texts.interestLabel).toBe("Cargo Financiero");
  });

  it("FRENCH_AMORTIZATION retorna 'Interés' como interestLabel", () => {
    const texts = getLoanStructureTexts("FRENCH_AMORTIZATION");
    expect(texts.interestLabel).toBe("Interés");
  });

  it("FLAT_RATE interestClause menciona 'cargo financiero'", () => {
    const texts = getLoanStructureTexts("FLAT_RATE");
    expect(texts.interestClause.toLowerCase()).toContain("cargo financiero");
  });

  it("FRENCH_AMORTIZATION interestClause menciona amortización francesa", () => {
    const texts = getLoanStructureTexts("FRENCH_AMORTIZATION");
    expect(texts.interestClause.toLowerCase()).toContain("francés");
  });

  it("FLAT_RATE paymentClause incluye termCount e installmentAmount", () => {
    const texts = getLoanStructureTexts("FLAT_RATE");
    const clause = texts.paymentClause({
      termCount: 45,
      installmentAmount: 300,
      frequency: PaymentFrequency.DAILY,
      totalFinanceCharge: 3500,
    });
    expect(clause).toContain("45");
    expect(clause).toContain("300");
  });

  it("FRENCH paymentClause incluye termCount y tasa anual", () => {
    const texts = getLoanStructureTexts("FRENCH_AMORTIZATION");
    const clause = texts.paymentClause({
      termCount: 12,
      installmentAmount: 4871.35,
      frequency: PaymentFrequency.MONTHLY,
      annualRate: 8,
    });
    expect(clause).toContain("12");
    expect(clause).toContain("8%");
  });

  it("FLAT_RATE paymentClause menciona el cargo financiero total", () => {
    const texts = getLoanStructureTexts("FLAT_RATE");
    const clause = texts.paymentClause({
      termCount: 8,
      installmentAmount: 1500,
      frequency: PaymentFrequency.WEEKLY,
      totalFinanceCharge: 2000,
    });
    expect(clause.toLowerCase()).toContain("cargo financiero");
  });
});
