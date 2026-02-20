import { describe, it, expect } from "vitest";
import { PaymentFrequency } from "@prisma/client";
import {
  calculateFlatRateLoan,
  calculateFlatRatePaymentDistribution,
  calculateFlatRateLateFee,
  getFrequencyTexts,
} from "../../../lib/domain/flatRateCalculator";

// ============================================
// calculateFlatRateLoan
// ============================================

describe("calculateFlatRateLoan", () => {
  const baseDaily = {
    principalAmount: 10000,
    totalFinanceCharge: 3500,
    termCount: 45,
    paymentFrequency: PaymentFrequency.DAILY,
    startDate: new Date("2026-01-01"),
  };

  const baseWeekly = {
    principalAmount: 10000,
    totalFinanceCharge: 2000,
    termCount: 8,
    paymentFrequency: PaymentFrequency.WEEKLY,
    startDate: new Date("2026-01-01"),
  };

  it("calcula cuota diaria correctamente", () => {
    const result = calculateFlatRateLoan(baseDaily);
    // 13500 / 45 = 300
    expect(result.installmentAmount).toBe(300);
  });

  it("calcula cuota semanal correctamente", () => {
    const result = calculateFlatRateLoan(baseWeekly);
    // 12000 / 8 = 1500
    expect(result.installmentAmount).toBe(1500);
  });

  it("totalPayableAmount = principalAmount + totalFinanceCharge", () => {
    const result = calculateFlatRateLoan(baseDaily);
    expect(result.totalPayableAmount).toBe(10000 + 3500);
  });

  it("genera el schedule con la cantidad correcta de entradas", () => {
    const result = calculateFlatRateLoan(baseDaily);
    expect(result.schedule).toHaveLength(45);
  });

  it("la primera cuota vence mañana para frecuencia DAILY", () => {
    const startDate = new Date("2026-01-01");
    const result = calculateFlatRateLoan({ ...baseDaily, startDate });
    const expectedDate = new Date("2026-01-02");
    expect(result.schedule[0].dueDate.toDateString()).toBe(expectedDate.toDateString());
  });

  it("la primera cuota vence en 7 días para frecuencia WEEKLY", () => {
    const startDate = new Date("2026-01-01");
    const result = calculateFlatRateLoan({ ...baseWeekly, startDate });
    const expectedDate = new Date("2026-01-08");
    expect(result.schedule[0].dueDate.toDateString()).toBe(expectedDate.toDateString());
  });

  it("lanza error si principalAmount <= 0", () => {
    expect(() =>
      calculateFlatRateLoan({ ...baseDaily, principalAmount: 0 })
    ).toThrow("El capital debe ser mayor a cero");
  });

  it("lanza error si termCount <= 0", () => {
    expect(() =>
      calculateFlatRateLoan({ ...baseDaily, termCount: 0 })
    ).toThrow("El número de cuotas debe ser mayor a cero");
  });

  it("el desglose proporcional suma correctamente", () => {
    const result = calculateFlatRateLoan(baseDaily);
    const totalPrincipal = Math.round(result.principalPerInstallment * result.termCount * 100) / 100;
    const totalInterest  = Math.round(result.interestPerInstallment  * result.termCount * 100) / 100;
    // Allow ±1 cent rounding tolerance
    expect(Math.abs(totalPrincipal - 10000)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(totalInterest  - 3500)).toBeLessThanOrEqual(0.5);
  });

  it("los números de cuota del schedule van de 1 a termCount", () => {
    const result = calculateFlatRateLoan(baseDaily);
    expect(result.schedule[0].installmentNumber).toBe(1);
    expect(result.schedule[44].installmentNumber).toBe(45);
  });
});

// ============================================
// calculateFlatRatePaymentDistribution
// ============================================

describe("calculateFlatRatePaymentDistribution", () => {
  const base = {
    installmentAmount: 300,
    pendingInstallments: 45,
    overdueInstallments: 0,
  };

  it("pago exacto de una cuota cubre 1 installment sin excedente", () => {
    const result = calculateFlatRatePaymentDistribution({
      ...base,
      paymentAmount: 300,
    });
    expect(result.installmentsCovered).toBe(1);
    expect(result.excessAmount).toBe(0);
    expect(result.isFullSettlement).toBe(false);
  });

  it("pago de 2 cuotas marca isFullSettlement=false e installmentsCovered=2", () => {
    const result = calculateFlatRatePaymentDistribution({
      ...base,
      paymentAmount: 600,
    });
    expect(result.installmentsCovered).toBe(2);
    expect(result.isFullSettlement).toBe(false);
  });

  it("pago mayor al total pendiente activa isFullSettlement con excedente", () => {
    const result = calculateFlatRatePaymentDistribution({
      installmentAmount: 300,
      pendingInstallments: 10,
      overdueInstallments: 0,
      paymentAmount: 3100, // 3000 + 100 extra
    });
    expect(result.isFullSettlement).toBe(true);
    expect(result.excessAmount).toBe(100);
    expect(result.installmentsCovered).toBe(10);
  });

  it("pago exacto del total pendiente activa isFullSettlement sin excedente", () => {
    const result = calculateFlatRatePaymentDistribution({
      installmentAmount: 300,
      pendingInstallments: 10,
      overdueInstallments: 0,
      paymentAmount: 3000,
    });
    expect(result.isFullSettlement).toBe(true);
    expect(result.excessAmount).toBe(0);
  });

  it("con mora pendiente, se descuenta primero antes de cubrir cuotas", () => {
    const result = calculateFlatRatePaymentDistribution({
      installmentAmount: 300,
      pendingInstallments: 10,
      overdueInstallments: 1,
      paymentAmount: 315,
      installmentAmount_lateFee: 15,
    });
    expect(result.lateFeeApplied).toBe(15);
    expect(result.installmentsCovered).toBe(1);
  });

  it("pago insuficiente para cubrir una cuota lanza error", () => {
    expect(() =>
      calculateFlatRatePaymentDistribution({
        ...base,
        paymentAmount: 100,
      })
    ).toThrow();
  });

  it("cargo sagrado: cuotas se marcan como pagadas sin recalcular el cargo financiero", () => {
    // El cálculo no modifica totalFinanceCharge — solo cuenta cuotas cubiertas
    const result = calculateFlatRatePaymentDistribution({
      installmentAmount: 300,
      pendingInstallments: 45,
      overdueInstallments: 0,
      paymentAmount: 600, // 2 cuotas adelantadas
    });
    // Solo se reportan cuotas cubiertas — el cargo total no cambia en el resultado
    expect(result.installmentsCovered).toBe(2);
    expect(result.isFullSettlement).toBe(false);
  });
});

// ============================================
// calculateFlatRateLateFee
// ============================================

describe("calculateFlatRateLateFee", () => {
  it("0 cuotas vencidas = 0 mora", () => {
    expect(calculateFlatRateLateFee(0, 300)).toBe(0);
  });

  it("mora = cuotas vencidas × installmentAmount × 5%", () => {
    // 2 × 300 × 0.05 = 30
    expect(calculateFlatRateLateFee(2, 300)).toBe(30);
  });

  it("mora de 1 cuota = installmentAmount × 5%", () => {
    expect(calculateFlatRateLateFee(1, 300)).toBe(15);
  });

  it("mora se redondea a 2 decimales", () => {
    // 3 × 333.33 × 0.05 = 49.9995 → 50
    const result = calculateFlatRateLateFee(3, 333.33);
    expect(Number.isFinite(result)).toBe(true);
    expect(result.toString().split(".")[1]?.length ?? 0).toBeLessThanOrEqual(2);
  });
});

// ============================================
// getFrequencyTexts
// ============================================

describe("getFrequencyTexts", () => {
  it("DAILY retorna textos en español correctos", () => {
    const texts = getFrequencyTexts(PaymentFrequency.DAILY);
    expect(texts.label).toBe("Diaria");
    expect(texts.cuota).toBe("cuotas diarias");
    expect(texts.periodo).toBe("días");
    expect(texts.periodoSingular).toBe("día");
  });

  it("WEEKLY retorna textos en español correctos", () => {
    const texts = getFrequencyTexts(PaymentFrequency.WEEKLY);
    expect(texts.label).toBe("Semanal");
    expect(texts.cuota).toBe("cuotas semanales");
  });

  it("BIWEEKLY retorna textos en español correctos", () => {
    const texts = getFrequencyTexts(PaymentFrequency.BIWEEKLY);
    expect(texts.label).toBe("Quincenal");
    expect(texts.cuota).toBe("cuotas quincenales");
  });

  it("MONTHLY retorna textos en español correctos", () => {
    const texts = getFrequencyTexts(PaymentFrequency.MONTHLY);
    expect(texts.label).toBe("Mensual");
    expect(texts.cuota).toBe("cuotas mensuales");
  });
});
