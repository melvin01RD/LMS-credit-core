import { prisma } from "../db/prisma";
import { LoanStatus, PaymentFrequency, PaymentType, Prisma } from "@prisma/client";
import { canApplyPayment, applyPayment } from "../domain/loan";

// ============================================
// INTERFACES
// ============================================

interface CreateLoanInput {
  clientId: string;
  principalAmount: number;
  annualInterestRate: number;
  paymentFrequency: PaymentFrequency;
  termCount: number;
  createdById: string;
  guarantees?: string;
}

interface RegisterPaymentInput {
  loanId: string;
  totalAmount: number;
  capitalApplied: number;
  interestApplied: number;
  lateFeeApplied?: number;
  type: PaymentType;
  createdById: string;
  paymentDate?: Date;
}

interface LoanFilters {
  clientId?: string;
  status?: LoanStatus;
  createdById?: string;
}

// ============================================
// CUSTOM ERRORS
// ============================================

export class LoanNotFoundError extends Error {
  constructor(loanId: string) {
    super(`Préstamo con ID ${loanId} no encontrado`);
    this.name = "LoanNotFoundError";
  }
}

export class PaymentNotAllowedError extends Error {
  constructor(loanId: string, status: LoanStatus) {
    super(`No se puede registrar pago en préstamo ${loanId} con estado ${status}`);
    this.name = "PaymentNotAllowedError";
  }
}

export class InvalidPaymentAmountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPaymentAmountError";
  }
}

// ============================================
// LOAN OPERATIONS
// ============================================

/**
 * Crea un nuevo préstamo
 */
export async function createLoan(data: CreateLoanInput) {
  const installmentAmount = data.principalAmount / data.termCount;

  // Calcular primera fecha de vencimiento según frecuencia
  const nextDueDate = calculateNextDueDate(new Date(), data.paymentFrequency);

  return prisma.loan.create({
    data: {
      clientId: data.clientId,
      principalAmount: data.principalAmount,
      annualInterestRate: data.annualInterestRate,
      paymentFrequency: data.paymentFrequency,
      termCount: data.termCount,
      installmentAmount,
      remainingCapital: data.principalAmount,
      nextDueDate,
      status: LoanStatus.ACTIVE,
      guarantees: data.guarantees,
      createdById: data.createdById,
    },
    include: {
      client: true,
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });
}

/**
 * Obtiene un préstamo por ID con relaciones
 */
export async function getLoanById(loanId: string) {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: {
      client: true,
      payments: {
        orderBy: { paymentDate: "desc" },
      },
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      updatedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  if (!loan) {
    throw new LoanNotFoundError(loanId);
  }

  return loan;
}

/**
 * Lista préstamos con filtros opcionales
 */
export async function getLoans(filters?: LoanFilters) {
  const where: Prisma.LoanWhereInput = {};

  if (filters?.clientId) {
    where.clientId = filters.clientId;
  }

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.createdById) {
    where.createdById = filters.createdById;
  }

  return prisma.loan.findMany({
    where,
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          documentId: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Registra un pago a un préstamo
 * Usa transacción para garantizar atomicidad
 */
export async function registerPayment(data: RegisterPaymentInput) {
  // Validar montos
  validatePaymentAmounts(data);

  // Ejecutar en transacción
  return prisma.$transaction(async (tx) => {
    // 1. Obtener el préstamo actual
    const loan = await tx.loan.findUnique({
      where: { id: data.loanId },
    });

    if (!loan) {
      throw new LoanNotFoundError(data.loanId);
    }

    // 2. Verificar que se puede aplicar el pago
    if (!canApplyPayment(loan.status)) {
      throw new PaymentNotAllowedError(data.loanId, loan.status);
    }

    // 3. Calcular nuevo balance y estado
    const currentBalance = Number(loan.remainingCapital);
    const { balance: newBalance, status: newStatus } = applyPayment(
      currentBalance,
      data.capitalApplied
    );

    // 4. Crear el registro de pago
    const payment = await tx.payment.create({
      data: {
        loanId: data.loanId,
        totalAmount: data.totalAmount,
        capitalApplied: data.capitalApplied,
        interestApplied: data.interestApplied,
        lateFeeApplied: data.lateFeeApplied ?? 0,
        type: data.type,
        createdById: data.createdById,
        paymentDate: data.paymentDate ?? new Date(),
      },
    });

    // 5. Actualizar el préstamo
    const updatedLoan = await tx.loan.update({
      where: { id: data.loanId },
      data: {
        remainingCapital: newBalance,
        status: newStatus,
        updatedById: data.createdById,
        // Calcular próxima fecha de vencimiento si no está pagado
        nextDueDate:
          newStatus === LoanStatus.PAID
            ? null
            : calculateNextDueDate(new Date(), loan.paymentFrequency),
      },
      include: {
        client: true,
      },
    });

    return {
      payment,
      loan: updatedLoan,
      previousBalance: currentBalance,
      newBalance,
      statusChanged: loan.status !== newStatus,
    };
  });
}

/**
 * Cancela un préstamo
 */
export async function cancelLoan(loanId: string, userId: string) {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
  });

  if (!loan) {
    throw new LoanNotFoundError(loanId);
  }

  if (loan.status === LoanStatus.PAID) {
    throw new Error("No se puede cancelar un préstamo ya pagado");
  }

  if (loan.status === LoanStatus.CANCELED) {
    throw new Error("El préstamo ya está cancelado");
  }

  return prisma.loan.update({
    where: { id: loanId },
    data: {
      status: LoanStatus.CANCELED,
      updatedById: userId,
    },
  });
}

/**
 * Marca un préstamo como vencido (OVERDUE)
 */
export async function markLoanAsOverdue(loanId: string, userId: string) {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
  });

  if (!loan) {
    throw new LoanNotFoundError(loanId);
  }

  if (loan.status !== LoanStatus.ACTIVE) {
    throw new Error(`Solo préstamos ACTIVE pueden marcarse como OVERDUE. Estado actual: ${loan.status}`);
  }

  return prisma.loan.update({
    where: { id: loanId },
    data: {
      status: LoanStatus.OVERDUE,
      updatedById: userId,
    },
  });
}

/**
 * Obtiene el historial de pagos de un préstamo
 */
export async function getLoanPayments(loanId: string) {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
  });

  if (!loan) {
    throw new LoanNotFoundError(loanId);
  }

  return prisma.payment.findMany({
    where: { loanId },
    include: {
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { paymentDate: "desc" },
  });
}

/**
 * Obtiene resumen de un préstamo
 */
export async function getLoanSummary(loanId: string) {
  const loan = await getLoanById(loanId);

  const payments = await prisma.payment.aggregate({
    where: { loanId },
    _sum: {
      totalAmount: true,
      capitalApplied: true,
      interestApplied: true,
      lateFeeApplied: true,
    },
    _count: true,
  });

  const principalAmount = Number(loan.principalAmount);
  const remainingCapital = Number(loan.remainingCapital);
  const totalPaid = Number(payments._sum.totalAmount ?? 0);
  const capitalPaid = Number(payments._sum.capitalApplied ?? 0);
  const interestPaid = Number(payments._sum.interestApplied ?? 0);
  const lateFeesPaid = Number(payments._sum.lateFeeApplied ?? 0);

  return {
    loan,
    summary: {
      principalAmount,
      remainingCapital,
      capitalPaid,
      interestPaid,
      lateFeesPaid,
      totalPaid,
      paymentCount: payments._count,
      progressPercentage: ((principalAmount - remainingCapital) / principalAmount) * 100,
    },
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calcula la próxima fecha de vencimiento según la frecuencia
 */
function calculateNextDueDate(fromDate: Date, frequency: PaymentFrequency): Date {
  const nextDate = new Date(fromDate);

  switch (frequency) {
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

/**
 * Valida los montos del pago
 */
function validatePaymentAmounts(data: RegisterPaymentInput): void {
  if (data.totalAmount <= 0) {
    throw new InvalidPaymentAmountError("El monto total debe ser mayor a cero");
  }

  if (data.capitalApplied < 0) {
    throw new InvalidPaymentAmountError("El capital aplicado no puede ser negativo");
  }

  if (data.interestApplied < 0) {
    throw new InvalidPaymentAmountError("El interés aplicado no puede ser negativo");
  }

  if (data.lateFeeApplied !== undefined && data.lateFeeApplied < 0) {
    throw new InvalidPaymentAmountError("La mora aplicada no puede ser negativa");
  }

  const sumOfParts =
    data.capitalApplied + data.interestApplied + (data.lateFeeApplied ?? 0);

  // Permitir pequeña diferencia por redondeo
  if (Math.abs(sumOfParts - data.totalAmount) > 0.01) {
    throw new InvalidPaymentAmountError(
      `La suma de capital (${data.capitalApplied}) + interés (${data.interestApplied}) + mora (${data.lateFeeApplied ?? 0}) debe ser igual al monto total (${data.totalAmount})`
    );
  }
}