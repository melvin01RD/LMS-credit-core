import { describe, it, expect } from "vitest";
import { canApplyPayment, applyPayment } from "../../../lib/domain/loan";
import { LoanStatus } from "@prisma/client";

describe("canApplyPayment", () => {
  it("should return true for ACTIVE loans", () => {
    expect(canApplyPayment(LoanStatus.ACTIVE)).toBe(true);
  });

  it("should return true for OVERDUE loans", () => {
    expect(canApplyPayment(LoanStatus.OVERDUE)).toBe(true);
  });

  it("should return false for CANCELED loans", () => {
    expect(canApplyPayment(LoanStatus.CANCELED)).toBe(false);
  });

  it("should return false for PAID loans", () => {
    expect(canApplyPayment(LoanStatus.PAID)).toBe(false);
  });
});

describe("applyPayment", () => {
  it("should reduce balance by payment amount", () => {
    const result = applyPayment(1000, 200);

    expect(result.balance).toBe(800);
    expect(result.status).toBe(LoanStatus.ACTIVE);
  });

  it("should mark loan as PAID when balance reaches zero", () => {
    const result = applyPayment(500, 500);

    expect(result.balance).toBe(0);
    expect(result.status).toBe(LoanStatus.PAID);
  });

  it("should mark loan as PAID when payment exceeds balance", () => {
    const result = applyPayment(300, 500);

    expect(result.balance).toBe(0);
    expect(result.status).toBe(LoanStatus.PAID);
  });

  it("should keep status ACTIVE when balance remains", () => {
    const result = applyPayment(10000, 1000);

    expect(result.balance).toBe(9000);
    expect(result.status).toBe(LoanStatus.ACTIVE);
  });

  it("should throw error for zero payment amount", () => {
    expect(() => applyPayment(1000, 0)).toThrow(
      "Monto del pago debe ser mas grande que cero"
    );
  });

  it("should throw error for negative payment amount", () => {
    expect(() => applyPayment(1000, -100)).toThrow(
      "Monto del pago debe ser mas grande que cero"
    );
  });
});
