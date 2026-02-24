import { LoanStatus, PaymentFrequency } from "@prisma/client";

// ============================================
// LOAN STATUS VALIDATION
// ============================================

/**
 * Verifica si un préstamo puede recibir pagos según su estado.
 * Solo ACTIVE y OVERDUE pueden recibir pagos.
 */
export function canApplyPayment(status: LoanStatus): boolean {
  return status !== LoanStatus.PAID && status !== LoanStatus.CANCELED;
}

/**
 * Aplica un pago al balance de un préstamo.
 * Retorna el nuevo balance y estado resultante.
 */
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

// ============================================
// DATE CALCULATIONS
// ============================================

/**
 * Calcula la próxima fecha de vencimiento según la frecuencia de pago.
 */
export function calculateNextDueDate(
  fromDate: Date,
  frequency: PaymentFrequency
): Date {
  const nextDate = new Date(fromDate);

  switch (frequency) {
    case PaymentFrequency.DAILY:
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case PaymentFrequency.WEEKLY:
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case PaymentFrequency.BIWEEKLY:
      nextDate.setDate(nextDate.getDate() + 14);
      break;
    case PaymentFrequency.MONTHLY:
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
  }

  return nextDate;
}
