import { prisma } from "../db/prisma";
import { LoanStatus, PaymentFrequency, Prisma } from "@prisma/client";
import {
  LoanNotFoundError,
  PaymentNotAllowedError,
} from "../errors";
import {
  canApplyPayment,
  calculateNextDueDate,
  calculateInstallmentAmount,
  generateAmortizationSchedule,
  AmortizationEntry,
} from "../domain/loan";
import { PaginationOptions, PaginatedResult } from "../types";
import { auditLog, AuditAction, AuditEntity } from "./audit.service";

// ============================================
// INTERFACES
// ============================================

export interface CreateLoanInput {
  clientId: string;
  principalAmount: number;
  annualInterestRate: number;
  paymentFrequency: PaymentFrequency;
  termCount: number;
  createdById: string;
  guarantees?: string;
}

export interface LoanFilters {
  clientId?: string;
  status?: LoanStatus;
  createdById?: string;
  search?: string;
}

// Re-export for convenience
export type { AmortizationEntry };

// ============================================
// LOAN OPERATIONS
// ============================================

/**
 * Crea un nuevo préstamo usando sistema francés para calcular cuotas
 */
export async function createLoan(data: CreateLoanInput) {
  // Calcular cuota fija con sistema francés (incluye intereses)
  const installmentAmount = calculateInstallmentAmount(
    data.principalAmount,
    data.annualInterestRate,
    data.termCount,
    data.paymentFrequency
  );

  // Calcular primera fecha de vencimiento según frecuencia
  const nextDueDate = calculateNextDueDate(new Date(), data.paymentFrequency);

  const loan = await prisma.loan.create({
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

  await auditLog(data.createdById, AuditAction.CREATE_LOAN, AuditEntity.LOAN, loan.id, {
    clientId: data.clientId,
    principalAmount: data.principalAmount,
    paymentFrequency: data.paymentFrequency,
    termCount: data.termCount,
  });

  return loan;
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
 * Lista préstamos con filtros opcionales y paginación
 */
export async function getLoans(
  filters?: LoanFilters,
  pagination?: PaginationOptions
): Promise<PaginatedResult<Awaited<ReturnType<typeof prisma.loan.findMany>>[number]>> {
  const page = pagination?.page ?? 1;
  const limit = pagination?.limit ?? 20;
  const skip = (page - 1) * limit;

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

  if (filters?.search) {
    const searchTerm = filters.search.trim();
    where.client = {
      OR: [
        { firstName: { contains: searchTerm, mode: "insensitive" } },
        { lastName: { contains: searchTerm, mode: "insensitive" } },
        { documentId: { contains: searchTerm, mode: "insensitive" } },
      ],
    };
  }

  const [loans, total] = await Promise.all([
    prisma.loan.findMany({
      where,
      skip,
      take: limit,
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
    }),
    prisma.loan.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    data: loans,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
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
    throw new PaymentNotAllowedError(loanId, loan.status);
  }

  if (loan.status === LoanStatus.CANCELED) {
    throw new Error("El préstamo ya está cancelado");
  }

  const canceledLoan = await prisma.loan.update({
    where: { id: loanId },
    data: {
      status: LoanStatus.CANCELED,
      updatedById: userId,
    },
  });

  await auditLog(userId, AuditAction.CANCEL_LOAN, AuditEntity.LOAN, loanId, {
    previousStatus: loan.status,
    remainingCapital: Number(loan.remainingCapital),
  });

  return canceledLoan;
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

/**
 * Obtiene la tabla de amortización de un préstamo existente
 */
export async function getLoanAmortization(loanId: string): Promise<AmortizationEntry[]> {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
  });

  if (!loan) {
    throw new LoanNotFoundError(loanId);
  }

  return generateAmortizationSchedule(
    Number(loan.principalAmount),
    Number(loan.annualInterestRate),
    loan.termCount,
    loan.paymentFrequency,
    loan.createdAt
  );
}

/**
 * Obtiene préstamos que están vencidos (nextDueDate < hoy y status = ACTIVE)
 */
export async function getOverdueLoans() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return prisma.loan.findMany({
    where: {
      status: LoanStatus.ACTIVE,
      nextDueDate: {
        lt: today,
      },
    },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          documentId: true,
          phone: true,
        },
      },
    },
    orderBy: { nextDueDate: "asc" },
  });
}

/**
 * Proceso batch: marca como OVERDUE todos los préstamos ACTIVE cuya nextDueDate ya pasó
 */
export async function processOverdueLoans(userId: string): Promise<{ affected: number }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result = await prisma.loan.updateMany({
    where: {
      status: LoanStatus.ACTIVE,
      nextDueDate: {
        lt: today,
      },
    },
    data: {
      status: LoanStatus.OVERDUE,
      updatedById: userId,
    },
  });

  return { affected: result.count };
}