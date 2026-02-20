import { describe, it, expect } from "vitest";
import { PaymentFrequency } from "@prisma/client";
import {
  calculateNextDueDate,
  calculatePendingInterest,
  calculateLateFee,
  calculateInstallmentAmount,
} from "../../../lib/domain/loan";

// ============================================
// calculateNextDueDate — BIWEEKLY & MONTHLY
// Lines 60-67 (the uncovered switch cases)
// ============================================

describe("calculateNextDueDate - BIWEEKLY y MONTHLY", () => {
  it("BIWEEKLY avanza 14 días", () => {
    const from = new Date("2026-01-01");
    const result = calculateNextDueDate(from, PaymentFrequency.BIWEEKLY);
    const expected = new Date("2026-01-15");
    expect(result.toDateString()).toBe(expected.toDateString());
  });

  it("MONTHLY avanza 1 mes", () => {
    const from = new Date("2026-01-15");
    const result = calculateNextDueDate(from, PaymentFrequency.MONTHLY);
    const expected = new Date("2026-02-15");
    expect(result.toDateString()).toBe(expected.toDateString());
  });

  it("DAILY avanza 1 día (smoke test existente)", () => {
    const from = new Date("2026-01-01");
    const result = calculateNextDueDate(from, PaymentFrequency.DAILY);
    expect(result.toDateString()).toBe(new Date("2026-01-02").toDateString());
  });

  it("WEEKLY avanza 7 días (smoke test existente)", () => {
    const from = new Date("2026-01-01");
    const result = calculateNextDueDate(from, PaymentFrequency.WEEKLY);
    expect(result.toDateString()).toBe(new Date("2026-01-08").toDateString());
  });

  it("no muta la fecha de entrada", () => {
    const from = new Date("2026-06-15");
    const originalTime = from.getTime();
    calculateNextDueDate(from, PaymentFrequency.BIWEEKLY);
    expect(from.getTime()).toBe(originalTime);
  });
});

// ============================================
// calculatePendingInterest
// Lines 93-103
// ============================================

describe("calculatePendingInterest", () => {
  it("retorna 0 si lastPaymentDate === paymentDate (mismo día)", () => {
    const today = new Date("2026-01-15");
    const result = calculatePendingInterest(10000, 24, today, today);
    expect(result).toBe(0);
  });

  it("retorna 0 si la tasa anual es 0", () => {
    const last = new Date("2026-01-01");
    const now = new Date("2026-02-01");
    const result = calculatePendingInterest(10000, 0, last, now);
    expect(result).toBe(0);
  });

  it("calcula interés diario sobre saldo pendiente", () => {
    // capital: 10000, tasa: 24% anual, período: 30 días
    // tasa diaria = 24/100/365 ≈ 0.000657534
    // interés = 10000 × 0.000657534 × 30 ≈ 197.26
    const last = new Date("2026-01-01");
    const now = new Date("2026-01-31");
    const result = calculatePendingInterest(10000, 24, last, now);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeCloseTo(197.26, 0);
  });

  it("interés es proporcional al capital", () => {
    const last = new Date("2026-01-01");
    const now = new Date("2026-02-01");
    const interest1 = calculatePendingInterest(10000, 24, last, now);
    const interest2 = calculatePendingInterest(20000, 24, last, now);
    expect(interest2).toBeCloseTo(interest1 * 2, 1);
  });

  it("usa lastPaymentDate null correctamente (usa currentDate como base)", () => {
    // Si lastPaymentDate es null, se usa currentDate como fromDate → daysDiff = 0 → interés = 0
    const now = new Date("2026-02-01");
    const result = calculatePendingInterest(10000, 24, null, now);
    expect(result).toBe(0);
  });

  it("interés se redondea a 2 decimales", () => {
    const last = new Date("2026-01-01");
    const now = new Date("2026-01-16");
    const result = calculatePendingInterest(10000, 24, last, now);
    const decimalPart = result.toString().split(".")[1];
    expect((decimalPart?.length ?? 0)).toBeLessThanOrEqual(2);
  });
});

// ============================================
// calculateLateFee
// Lines 111-117
// ============================================

describe("calculateLateFee", () => {
  it("retorna 0 cuando daysLate es 0", () => {
    expect(calculateLateFee(10000, 0)).toBe(0);
  });

  it("retorna 0 cuando daysLate es negativo", () => {
    expect(calculateLateFee(10000, -5)).toBe(0);
  });

  it("mora es positiva para días de retraso > 0", () => {
    const result = calculateLateFee(10000, 5);
    expect(result).toBeGreaterThan(0);
  });

  it("mora aumenta con más días de retraso (por tramo de 30 días)", () => {
    const fee30 = calculateLateFee(10000, 30);
    const fee60 = calculateLateFee(10000, 60);
    expect(fee60).toBeGreaterThan(fee30);
  });

  it("mora es proporcional al capital", () => {
    const fee1 = calculateLateFee(10000, 5);
    const fee2 = calculateLateFee(20000, 5);
    expect(fee2).toBeCloseTo(fee1 * 2, 1);
  });

  it("usa tasa de mora personalizada", () => {
    const defaultFee = calculateLateFee(10000, 30); // tasa default 5%
    const customFee = calculateLateFee(10000, 30, 0.10); // tasa 10%
    expect(customFee).toBeCloseTo(defaultFee * 2, 1);
  });

  it("mora se redondea a 2 decimales", () => {
    const result = calculateLateFee(10000, 15);
    const parts = result.toString().split(".");
    expect((parts[1]?.length ?? 0)).toBeLessThanOrEqual(2);
  });
});

// ============================================
// calculateInstallmentAmount — tasa cero
// Line 159
// ============================================

describe("calculateInstallmentAmount - tasa cero", () => {
  it("cuando tasa es 0, cuota = principalAmount / termCount", () => {
    // r = 0 → installment = 10000 / 12 = 833.33
    const result = calculateInstallmentAmount(10000, 0, 12, PaymentFrequency.MONTHLY);
    expect(result).toBeCloseTo(833.33, 2);
  });

  it("cuando tasa es 0 en DAILY, cuota = principalAmount / termCount", () => {
    // 5000 / 30 = 166.67
    const result = calculateInstallmentAmount(5000, 0, 30, PaymentFrequency.DAILY);
    expect(result).toBeCloseTo(166.67, 2);
  });
});
