
import { prisma } from "../db/prisma";
import { LoanStatus, PaymentType, Prisma } from "@prisma/client";
import {
  PaymentNotFoundError,
  PaymentExceedsBalanceError,
  LoanNotFoundError,
  PaymentNotAllowedError,
  InvalidPaymentAmountError,
  CannotReversePaymentError,
} from "../errors";
import {
  calculateNextDueDate,
  calculatePendingInterest,
  calculateLateFee,
} from "../domain/loan";
import { PaginationOptions, PaginatedResult } from "../types";
import { auditLog, AuditAction, AuditEntity } from "./audit.service";

// ============================================
// INTERFACES
// ============================================

export interface CreatePaymentInput {
  loanId: string;
  totalAmount: number;
  type: PaymentType;
  createdById: string;
  paymentDate?: Date;
  capitalApplied?: number;
  interestApplied?: number;
  lateFeeApplied?: number;
}

export interface PaymentDistribution {
  capitalApplied: number;
  interestApplied: number;
  lateFeeApplied: number;
  totalAmount: number;
}

export interface PaymentFilters {
  loanId?: string;
  type?: PaymentType;
  createdById?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface PaymentResult {
  payment: Awaited<ReturnType<typeof prisma.payment.create>>;
  loan: Awaited<ReturnType<typeof prisma.loan.update>>;
  previousBalance: number;
  newBalance: number;
  statusChanged: boolean;
}

// ============================================
// VALIDATION
// ============================================

function validatePaymentAmounts(
  totalAmount: number,
  capitalApplied: number,
  interestApplied: number,
  lateFeeApplied: number
): void {
  if (totalAmount <= 0) {
    throw new InvalidPaymentAmountError("El monto total debe ser mayor a cero");
  }

  if (capitalApplied < 0) {
    throw new InvalidPaymentAmountError("El capital aplicado no puede ser negativo");
  }

  if (interestApplied < 0) {
    throw new InvalidPaymentAmountError("El interés aplicado no puede ser negativo");
  }

  if (lateFeeApplied < 0) {
    throw new InvalidPaymentAmountError("La mora aplicada no puede ser negativa");
  }

  const sumOfParts = capitalApplied + interestApplied + lateFeeApplied;

  if (Math.abs(sumOfParts - totalAmount) > 0.01) {
    throw new InvalidPaymentAmountError(
      `La suma de capital (${capitalApplied}) + interés (${interestApplied}) + mora (${lateFeeApplied}) debe ser igual al monto total (${totalAmount})`
    );
  }
}

// ============================================
// PAYMENT OPERATIONS
// ============================================

export async function calculatePaymentDistribution(
  loanId: string,
  paymentAmount: number,
  paymentDate: Date = new Date()
): Promise<PaymentDistribution> {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: {
      payments: {
        orderBy: { paymentDate: "desc" },
        take: 1,
      },
    },
  });

  if (!loan) {
    throw new LoanNotFoundError(loanId);
  }

  const remainingCapital = Number(loan.remainingCapital);
  const annualRate = Number(loan.annualInterestRate);
  const lastPaymentDate = loan.payments[0]?.paymentDate || loan.createdAt;

  const pendingInterest = calculatePendingInterest(
    remainingCapital,
    annualRate,
    lastPaymentDate,
    paymentDate
  );

  let lateFee = 0;
  if (loan.nextDueDate && paymentDate > loan.nextDueDate) {
    const daysLate = Math.floor(
      (paymentDate.getTime() - loan.nextDueDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    lateFee = calculateLateFee(remainingCapital, daysLate);
  }

  let remaining = paymentAmount;

  const lateFeeApplied = Math.min(remaining, lateFee);
  remaining -= lateFeeApplied;

  const interestApplied = Math.min(remaining, pendingInterest);
  remaining -= interestApplied;

  const capitalApplied = Math.min(remaining, remainingCapital);

  return {
    lateFeeApplied: Number(lateFeeApplied.toFixed(2)),
    interestApplied: Number(interestApplied.toFixed(2)),
    capitalApplied: Number(capitalApplied.toFixed(2)),
    totalAmount: Number(paymentAmount.toFixed(2)),
  };
}

export async function createPayment(data: CreatePaymentInput): Promise<PaymentResult> {
  let distribution: PaymentDistribution;

  if (data.capitalApplied !== undefined && data.interestApplied !== undefined) {
    validatePaymentAmounts(
      data.totalAmount,
      data.capitalApplied,
      data.interestApplied,
      data.lateFeeApplied ?? 0
    );

    distribution = {
      totalAmount: data.totalAmount,
      capitalApplied: data.capitalApplied,
      interestApplied: data.interestApplied,
      lateFeeApplied: data.lateFeeApplied ?? 0,
    };
  } else {
    distribution = await calculatePaymentDistribution(
      data.loanId,
      data.totalAmount,
      data.paymentDate ?? new Date()
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const loan = await tx.loan.findUnique({
      where: { id: data.loanId },
    });

    if (!loan) {
      throw new LoanNotFoundError(data.loanId);
    }

    if (loan.status === LoanStatus.PAID) {
      throw new PaymentNotAllowedError(data.loanId, loan.status);
    }

    const currentBalance = Number(loan.remainingCapital);
    if (distribution.capitalApplied > currentBalance) {
      throw new PaymentExceedsBalanceError(distribution.capitalApplied, currentBalance);
    }

    const newBalance = Math.max(0, currentBalance - distribution.capitalApplied);
    const newStatus = newBalance <= 0 ? LoanStatus.PAID : LoanStatus.ACTIVE;

    const payment = await tx.payment.create({
      data: {
        loanId: data.loanId,
        totalAmount: distribution.totalAmount,
        capitalApplied: distribution.capitalApplied,
        interestApplied: distribution.interestApplied,
        lateFeeApplied: distribution.lateFeeApplied,
        type: data.type,
        createdById: data.createdById,
        paymentDate: data.paymentDate ?? new Date(),
      },
    });

    const updatedLoan = await tx.loan.update({
      where: { id: data.loanId },
      data: {
        remainingCapital: newBalance,
        status: newStatus,
        updatedById: data.createdById,
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

  await auditLog(data.createdById, AuditAction.REGISTER_PAYMENT, AuditEntity.PAYMENT, result.payment.id, {
    totalAmount: Number(result.payment.totalAmount),
    loanId: data.loanId,
    type: data.type,
    previousBalance: result.previousBalance,
    newBalance: result.newBalance,
  });

  return result;
}

export async function getPaymentById(paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      loan: {
        include: {
          client: true,
        },
      },
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

  if (!payment) {
    throw new PaymentNotFoundError(paymentId);
  }

  return payment;
}

export async function getPayments(
  filters?: PaymentFilters,
  pagination?: PaginationOptions
): Promise<PaginatedResult<Awaited<ReturnType<typeof prisma.payment.findMany>>[number]>> {
  const page = pagination?.page ?? 1;
  const limit = pagination?.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: Prisma.PaymentWhereInput = {};

  if (filters?.loanId) {
    where.loanId = filters.loanId;
  }

  if (filters?.type) {
    where.type = filters.type;
  }

  if (filters?.createdById) {
    where.createdById = filters.createdById;
  }

  if (filters?.dateFrom || filters?.dateTo) {
    where.paymentDate = {};
    if (filters.dateFrom) {
      where.paymentDate.gte = filters.dateFrom;
    }
    if (filters.dateTo) {
      where.paymentDate.lte = filters.dateTo;
    }
  }

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      skip,
      take: limit,
      include: {
        loan: {
          select: {
            id: true,
            client: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                documentId: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { paymentDate: "desc" },
    }),
    prisma.payment.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    data: payments,
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

export async function getPaymentsByLoan(loanId: string) {
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

export async function reversePayment(
  paymentId: string,
  reversedById: string,
  reason: string
): Promise<PaymentResult> {
  const result = await prisma.$transaction(async (tx) => {
    const originalPayment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: {
        loan: true,
      },
    });

    if (!originalPayment) {
      throw new PaymentNotFoundError(paymentId);
    }

    if (originalPayment.loan.status === LoanStatus.CANCELED) {
      throw new CannotReversePaymentError(paymentId, "El préstamo está cancelado");
    }

    const currentBalance = Number(originalPayment.loan.remainingCapital);
    const capitalToRestore = Number(originalPayment.capitalApplied);
    const newBalance = currentBalance + capitalToRestore;

    const reversalPayment = await tx.payment.create({
      data: {
        loanId: originalPayment.loanId,
        totalAmount: -Number(originalPayment.totalAmount),
        capitalApplied: -capitalToRestore,
        interestApplied: -Number(originalPayment.interestApplied),
        lateFeeApplied: -Number(originalPayment.lateFeeApplied),
        type: originalPayment.type,
        createdById: reversedById,
        paymentDate: new Date(),
      },
    });

    const newStatus =
      newBalance <= 0
        ? LoanStatus.PAID
        : originalPayment.loan.status === LoanStatus.PAID
        ? LoanStatus.ACTIVE
        : originalPayment.loan.status;

    const updatedLoan = await tx.loan.update({
      where: { id: originalPayment.loanId },
      data: {
        remainingCapital: newBalance,
        status: newStatus,
        updatedById: reversedById,
        nextDueDate:
          newStatus !== LoanStatus.PAID
            ? calculateNextDueDate(new Date(), originalPayment.loan.paymentFrequency)
            : null,
      },
      include: {
        client: true,
      },
    });

    return {
      payment: reversalPayment,
      loan: updatedLoan,
      previousBalance: currentBalance,
      newBalance,
      statusChanged: originalPayment.loan.status !== newStatus,
    };
  });

  await auditLog(reversedById, AuditAction.REVERSE_PAYMENT, AuditEntity.PAYMENT, result.payment.id, {
    originalPaymentId: paymentId,
    loanId: result.loan.id,
    reversedAmount: Number(result.payment.totalAmount),
    reason,
  });

  return result;
}

export async function getPaymentsSummary(loanId: string) {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
  });

  if (!loan) {
    throw new LoanNotFoundError(loanId);
  }

  const aggregation = await prisma.payment.aggregate({
    where: { loanId },
    _sum: {
      totalAmount: true,
      capitalApplied: true,
      interestApplied: true,
      lateFeeApplied: true,
    },
    _count: true,
    _max: {
      paymentDate: true,
    },
    _min: {
      paymentDate: true,
    },
  });

  return {
    loanId,
    totalPayments: aggregation._count,
    totalPaid: Number(aggregation._sum.totalAmount ?? 0),
    totalCapitalPaid: Number(aggregation._sum.capitalApplied ?? 0),
    totalInterestPaid: Number(aggregation._sum.interestApplied ?? 0),
    totalLateFeesPaid: Number(aggregation._sum.lateFeeApplied ?? 0),
    firstPaymentDate: aggregation._min.paymentDate,
    lastPaymentDate: aggregation._max.paymentDate,
    principalAmount: Number(loan.principalAmount),
    remainingCapital: Number(loan.remainingCapital),
    progressPercentage:
      ((Number(loan.principalAmount) - Number(loan.remainingCapital)) /
        Number(loan.principalAmount)) *
      100,
  };
}

export async function getTodayPayments() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return prisma.payment.findMany({
    where: {
      paymentDate: {
        gte: today,
        lt: tomorrow,
      },
    },
    include: {
      loan: {
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
      },
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
