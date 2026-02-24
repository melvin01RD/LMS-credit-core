import { describe, it, expect } from "vitest";
import { PaymentFrequency } from "@prisma/client";
import {
  calculateNextDueDate,
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
