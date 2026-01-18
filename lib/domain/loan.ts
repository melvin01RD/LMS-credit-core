import { LoanStatus } from "@prisma/client";

export function canApplyPayment(status: LoanStatus) {
  return status !== LoanStatus.PAID;
}

export function applyPayment(balance: number, amount: number) {
  if (amount <= 0) {
    throw new Error("Monto del pago debe ser mas grande que cero");
  }

  const newBalance = balance - amount;

  return {
    balance: newBalance > 0 ? newBalance : 0,
    status: newBalance <= 0 ? LoanStatus.PAID : LoanStatus.ACTIVE,
  };
}
