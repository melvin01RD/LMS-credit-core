import { LoanStatus, PaymentFrequency } from "@prisma/client";

// ============================================
// INTERFACES
// ============================================

export interface AmortizationEntry {
  installmentNumber: number;
  dueDate: Date;
  totalPayment: number;
  principalPayment: number;
  interestPayment: number;
  remainingBalance: number;
}

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

// ============================================
// INTEREST AND FEE CALCULATIONS
// ============================================

/**
 * Calcula el interés pendiente basado en días transcurridos.
 * @param remainingCapital - Capital restante del préstamo
 * @param annualRate - Tasa de interés anual (ej: 24 para 24%)
 * @param lastPaymentDate - Fecha del último pago o inicio
 * @param currentDate - Fecha actual para el cálculo
 */
export function calculatePendingInterest(
  remainingCapital: number,
  annualRate: number,
  lastPaymentDate: Date | null,
  currentDate: Date = new Date()
): number {
  const fromDate = lastPaymentDate || currentDate;
  const daysDiff = Math.max(
    0,
    Math.floor((currentDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24))
  );

  if (daysDiff === 0) return 0;

  const dailyRate = annualRate / 100 / 365;
  return Number((remainingCapital * dailyRate * daysDiff).toFixed(2));
}

/**
 * Calcula la mora por días de atraso.
 * @param remainingCapital - Capital restante
 * @param daysLate - Días de atraso
 * @param lateFeeRate - Tasa de mora (default 5%)
 */
export function calculateLateFee(
  remainingCapital: number,
  daysLate: number,
  lateFeeRate: number = 0.05
): number {
  if (daysLate <= 0) return 0;
  return Number((remainingCapital * lateFeeRate * Math.ceil(daysLate / 30)).toFixed(2));
}

// ============================================
// AMORTIZATION CALCULATIONS (Sistema Francés)
// ============================================

/**
 * Convierte tasa anual a tasa periódica según frecuencia.
 * @param annualRate - Tasa anual (ej: 24 para 24%)
 * @param frequency - Frecuencia de pago
 */
export function getPeriodicRate(annualRate: number, frequency: PaymentFrequency): number {
  const periodsPerYear = {
    [PaymentFrequency.DAILY]: 365,
    [PaymentFrequency.WEEKLY]: 52,
    [PaymentFrequency.BIWEEKLY]: 26,
    [PaymentFrequency.MONTHLY]: 12,
  };

  return (annualRate / 100) / periodsPerYear[frequency];
}

/**
 * Calcula la cuota fija periódica usando el sistema francés.
 * Fórmula: C = P * [r(1+r)^n] / [(1+r)^n - 1]
 * 
 * @param principalAmount - Monto del préstamo
 * @param annualInterestRate - Tasa de interés anual (ej: 24 para 24%)
 * @param termCount - Número de cuotas
 * @param frequency - Frecuencia de pago
 */
export function calculateInstallmentAmount(
  principalAmount: number,
  annualInterestRate: number,
  termCount: number,
  frequency: PaymentFrequency
): number {
  const r = getPeriodicRate(annualInterestRate, frequency);
  
  // Si tasa es 0, la cuota es simplemente el principal dividido entre los términos
  if (r === 0) {
    return Number((principalAmount / termCount).toFixed(2));
  }

  const factor = Math.pow(1 + r, termCount);
  const installment = principalAmount * (r * factor) / (factor - 1);

  return Number(installment.toFixed(2));
}

/**
 * Genera tabla de amortización completa para un préstamo.
 * Método: Cuota fija (sistema francés).
 * 
 * @param principalAmount - Monto del préstamo
 * @param annualInterestRate - Tasa de interés anual (ej: 24 para 24%)
 * @param termCount - Número de cuotas
 * @param frequency - Frecuencia de pago
 * @param startDate - Fecha de inicio del préstamo
 */
export function generateAmortizationSchedule(
  principalAmount: number,
  annualInterestRate: number,
  termCount: number,
  frequency: PaymentFrequency,
  startDate: Date
): AmortizationEntry[] {
  const schedule: AmortizationEntry[] = [];
  const periodicRate = getPeriodicRate(annualInterestRate, frequency);
  const installmentAmount = calculateInstallmentAmount(
    principalAmount,
    annualInterestRate,
    termCount,
    frequency
  );

  let remainingBalance = principalAmount;
  let currentDate = new Date(startDate);

  for (let i = 1; i <= termCount; i++) {
    currentDate = calculateNextDueDate(currentDate, frequency);
    
    // Calcular interés del período
    const interestPayment = Number((remainingBalance * periodicRate).toFixed(2));
    
    // La última cuota ajusta para cerrar exactamente a 0
    let principalPayment: number;
    let totalPayment: number;

    if (i === termCount) {
      // Última cuota: ajustar para eliminar centavos colgados
      principalPayment = Number(remainingBalance.toFixed(2));
      totalPayment = Number((principalPayment + interestPayment).toFixed(2));
    } else {
      principalPayment = Number((installmentAmount - interestPayment).toFixed(2));
      totalPayment = installmentAmount;
    }

    remainingBalance = Number((remainingBalance - principalPayment).toFixed(2));
    
    // Asegurar que no quede negativo por redondeo
    if (remainingBalance < 0) remainingBalance = 0;

    schedule.push({
      installmentNumber: i,
      dueDate: new Date(currentDate),
      totalPayment,
      principalPayment,
      interestPayment,
      remainingBalance,
    });
  }

  return schedule;
}