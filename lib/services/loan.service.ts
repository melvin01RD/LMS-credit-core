import { prisma } from "../db/prisma";
import { LoanStatus, LoanStructure, PaymentFrequency, ScheduleStatus, Prisma } from "@prisma/client";
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
import {
  calculateFlatRateLoan,
  generateFlatRateSchedule,
  FlatRateLoanInput,
  FlatRateLoanResult,
} from "../domain/flatRateCalculator";
import { PaginationOptions, PaginatedResult } from "../types";
import { auditLog, AuditAction, AuditEntity } from "./audit.service";

// ============================================
// INTERFACES
// ============================================

interface CreateFrenchLoanInput {
  loanStructure: "FRENCH_AMORTIZATION";
  clientId: string;
  principalAmount: number;
  annualInterestRate: number;   // requerido en francés
  paymentFrequency: PaymentFrequency;
  termCount: number;
  createdById: string;
  guarantees?: string;
}

interface CreateFlatRateLoanInput {
  loanStructure: "FLAT_RATE";
  clientId: string;
  principalAmount: number;
  totalFinanceCharge: number;   // cargo fijo acordado — requerido en flat rate
  paymentFrequency: PaymentFrequency;
  termCount: number;
  createdById: string;
  guarantees?: string;
}

// Union type — el discriminante es loanStructure
export type CreateLoanInput = CreateFrenchLoanInput | CreateFlatRateLoanInput;

export interface LoanFilters {
  clientId?: string;
  status?: LoanStatus;
  loanStructure?: LoanStructure;
  createdById?: string;
  search?: string;
}

export type { AmortizationEntry };

// ============================================
// HELPERS INTERNOS
// ============================================

function isFlatRate(data: CreateLoanInput): data is CreateFlatRateLoanInput {
  return data.loanStructure === "FLAT_RATE";
}

/**
 * Persiste el PaymentSchedule en DB para cualquier tipo de préstamo.
 * Se llama dentro de la misma transacción de creación del loan.
 */
async function createPaymentScheduleInTx(
  tx: Prisma.TransactionClient,
  loanId: string,
  schedule: Array<{
    installmentNumber: number;
    dueDate: Date;
    expectedAmount: number;
    principalExpected: number;
    interestExpected: number;
  }>
) {
  await tx.paymentSchedule.createMany({
    data: schedule.map((entry) => ({
      loanId,
      installmentNumber: entry.installmentNumber,
      dueDate: entry.dueDate,
      expectedAmount: entry.expectedAmount,
      principalExpected: entry.principalExpected,
      interestExpected: entry.interestExpected,
      status: ScheduleStatus.PENDING,
    })),
  });
}

// ============================================
// LOAN OPERATIONS
// ============================================

/**
 * Crea un préstamo nuevo.
 * Detecta automáticamente si es Francés o Flat Rate y aplica la lógica correcta.
 */
export async function createLoan(data: CreateLoanInput) {
  if (isFlatRate(data)) {
    return createFlatRateLoan(data);
  }
  return createFrenchLoan(data);
}

/**
 * Crea préstamo con amortización francesa (comportamiento original).
 */
async function createFrenchLoan(data: CreateFrenchLoanInput) {
  const installmentAmount = calculateInstallmentAmount(
    data.principalAmount,
    data.annualInterestRate,
    data.termCount,
    data.paymentFrequency
  );

  const nextDueDate = calculateNextDueDate(new Date(), data.paymentFrequency);

  // Generar schedule para persistirlo en DB
  const amortizationSchedule = generateAmortizationSchedule(
    data.principalAmount,
    data.annualInterestRate,
    data.termCount,
    data.paymentFrequency,
    new Date()
  );

  const loan = await prisma.$transaction(async (tx) => {
    const newLoan = await tx.loan.create({
      data: {
        clientId: data.clientId,
        loanStructure: LoanStructure.FRENCH_AMORTIZATION,
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
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    // Persistir schedule en DB — usando nombres de campo correctos de AmortizationEntry
    await createPaymentScheduleInTx(
      tx,
      newLoan.id,
      amortizationSchedule.map((entry) => ({
        installmentNumber: entry.installmentNumber,
        dueDate: entry.dueDate,
        expectedAmount: entry.totalPayment,
        principalExpected: entry.principalPayment,
        interestExpected: entry.interestPayment,
      }))
    );

    return newLoan;
  });

  await auditLog(data.createdById, AuditAction.CREATE_LOAN, AuditEntity.LOAN, loan.id, {
    loanStructure: "FRENCH_AMORTIZATION",
    clientId: data.clientId,
    principalAmount: data.principalAmount,
    annualInterestRate: data.annualInterestRate,
    paymentFrequency: data.paymentFrequency,
    termCount: data.termCount,
  });

  return loan;
}

/**
 * Crea préstamo Flat Rate (diario / semanal / quincenal).
 * El cargo financiero es fijo desde el día 1.
 */
async function createFlatRateLoan(data: CreateFlatRateLoanInput) {
  const calc = calculateFlatRateLoan({
    principalAmount: data.principalAmount,
    totalFinanceCharge: data.totalFinanceCharge,
    termCount: data.termCount,
    paymentFrequency: data.paymentFrequency,
    startDate: new Date(),
  });

  const nextDueDate = calc.schedule[0]?.dueDate ?? null;

  const loan = await prisma.$transaction(async (tx) => {
    const newLoan = await tx.loan.create({
      data: {
        clientId: data.clientId,
        loanStructure: LoanStructure.FLAT_RATE,
        principalAmount: data.principalAmount,
        annualInterestRate: null,              // no aplica en flat rate
        totalFinanceCharge: data.totalFinanceCharge,
        totalPayableAmount: calc.totalPayableAmount,
        paymentFrequency: data.paymentFrequency,
        termCount: data.termCount,
        installmentAmount: calc.installmentAmount,
        remainingCapital: calc.totalPayableAmount, // total por cobrar
        installmentsPaid: 0,
        nextDueDate,
        status: LoanStatus.ACTIVE,
        guarantees: data.guarantees,
        createdById: data.createdById,
      },
      include: {
        client: true,
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    // Persistir las N cuotas del schedule en DB
    await createPaymentScheduleInTx(tx, newLoan.id, calc.schedule);

    return newLoan;
  });

  await auditLog(data.createdById, AuditAction.CREATE_LOAN, AuditEntity.LOAN, loan.id, {
    loanStructure: "FLAT_RATE",
    clientId: data.clientId,
    principalAmount: data.principalAmount,
    totalFinanceCharge: data.totalFinanceCharge,
    totalPayableAmount: calc.totalPayableAmount,
    installmentAmount: calc.installmentAmount,
    paymentFrequency: data.paymentFrequency,
    termCount: data.termCount,
  });

  return loan;
}

// ============================================
// SCHEDULE QUERIES
// ============================================

/**
 * Obtiene el plan de cuotas de un préstamo con estados actualizados.
 * Sirve para Flat Rate Y Francés.
 */
export async function getLoanSchedule(loanId: string) {
  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan) throw new LoanNotFoundError(loanId);

  return prisma.paymentSchedule.findMany({
    where: { loanId },
    orderBy: { installmentNumber: "asc" },
  });
}

/**
 * Obtiene las cuotas pendientes de un préstamo Flat Rate.
 */
export async function getPendingScheduleEntries(loanId: string) {
  return prisma.paymentSchedule.findMany({
    where: {
      loanId,
      status: { in: [ScheduleStatus.PENDING, ScheduleStatus.OVERDUE] },
    },
    orderBy: { installmentNumber: "asc" },
  });
}

/**
 * Obtiene las cuotas vencidas (OVERDUE) de un préstamo.
 */
export async function getOverdueScheduleEntries(loanId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return prisma.paymentSchedule.findMany({
    where: {
      loanId,
      status: ScheduleStatus.PENDING,
      dueDate: { lt: today },
    },
    orderBy: { installmentNumber: "asc" },
  });
}

// ============================================
// QUERIES EXISTENTES
// ============================================

export async function getLoanById(loanId: string) {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: {
      client: true,
      payments: { orderBy: { paymentDate: "desc" } },
      paymentSchedule: { orderBy: { installmentNumber: "asc" } },
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      updatedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  if (!loan) throw new LoanNotFoundError(loanId);
  return loan;
}

export async function getLoans(
  filters?: LoanFilters,
  pagination?: PaginationOptions
): Promise<PaginatedResult<Awaited<ReturnType<typeof prisma.loan.findMany>>[number]>> {
  const page = pagination?.page ?? 1;
  const limit = pagination?.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: Prisma.LoanWhereInput = {};

  if (filters?.clientId)      where.clientId = filters.clientId;
  if (filters?.status)        where.status = filters.status;
  if (filters?.loanStructure) where.loanStructure = filters.loanStructure;
  if (filters?.createdById)   where.createdById = filters.createdById;

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
          select: { id: true, firstName: true, lastName: true, documentId: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.loan.count({ where }),
  ]);

  return {
    data: loans,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    },
  };
}

export async function cancelLoan(loanId: string, userId: string) {
  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan) throw new LoanNotFoundError(loanId);
  if (loan.status === LoanStatus.PAID) throw new PaymentNotAllowedError(loanId, loan.status);
  if (loan.status === LoanStatus.CANCELED) throw new Error("El préstamo ya está cancelado");

  const canceledLoan = await prisma.loan.update({
    where: { id: loanId },
    data: { status: LoanStatus.CANCELED, updatedById: userId },
  });

  await auditLog(userId, AuditAction.CANCEL_LOAN, AuditEntity.LOAN, loanId, {
    previousStatus: loan.status,
    remainingCapital: Number(loan.remainingCapital),
  });

  return canceledLoan;
}

export async function markLoanAsOverdue(loanId: string, userId: string) {
  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan) throw new LoanNotFoundError(loanId);
  if (loan.status !== LoanStatus.ACTIVE) {
    throw new Error(`Solo préstamos ACTIVE pueden marcarse como OVERDUE. Estado actual: ${loan.status}`);
  }

  return prisma.loan.update({
    where: { id: loanId },
    data: { status: LoanStatus.OVERDUE, updatedById: userId },
  });
}

export async function getLoanPayments(loanId: string) {
  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan) throw new LoanNotFoundError(loanId);

  return prisma.payment.findMany({
    where: { loanId },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { paymentDate: "desc" },
  });
}

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

  const principalAmount    = Number(loan.principalAmount);
  const remainingCapital   = Number(loan.remainingCapital);
  const totalPaid          = Number(payments._sum.totalAmount ?? 0);
  const capitalPaid        = Number(payments._sum.capitalApplied ?? 0);
  const interestPaid       = Number(payments._sum.interestApplied ?? 0);
  const lateFeesPaid       = Number(payments._sum.lateFeeApplied ?? 0);
  const totalPayableAmount = Number(loan.totalPayableAmount ?? principalAmount);

  // Para Flat Rate el progreso es por cuotas pagadas
  const progressPercentage =
    loan.loanStructure === LoanStructure.FLAT_RATE
      ? (loan.installmentsPaid / loan.termCount) * 100
      : ((principalAmount - remainingCapital) / principalAmount) * 100;

  return {
    loan,
    summary: {
      principalAmount,
      remainingCapital,
      totalPayableAmount,
      capitalPaid,
      interestPaid,
      lateFeesPaid,
      totalPaid,
      paymentCount: payments._count,
      progressPercentage,
      installmentsPaid: loan.installmentsPaid,
      installmentsPending: loan.termCount - loan.installmentsPaid,
    },
  };
}

/**
 * Para préstamos Franceses: genera tabla de amortización.
 * Para Flat Rate: retorna el PaymentSchedule desde DB.
 */
export async function getLoanAmortization(loanId: string): Promise<AmortizationEntry[] | Awaited<ReturnType<typeof getLoanSchedule>>> {
  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan) throw new LoanNotFoundError(loanId);

  if (loan.loanStructure === LoanStructure.FLAT_RATE) {
    return getLoanSchedule(loanId);
  }

  return generateAmortizationSchedule(
    Number(loan.principalAmount),
    Number(loan.annualInterestRate),
    loan.termCount,
    loan.paymentFrequency,
    loan.createdAt
  );
}

export async function getOverdueLoans() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return prisma.loan.findMany({
    where: {
      status: LoanStatus.ACTIVE,
      nextDueDate: { lt: today },
    },
    include: {
      client: {
        select: { id: true, firstName: true, lastName: true, documentId: true, phone: true },
      },
    },
    orderBy: { nextDueDate: "asc" },
  });
}

export async function processOverdueLoans(userId: string): Promise<{ affected: number }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Marcar cuotas del schedule como OVERDUE
  await prisma.paymentSchedule.updateMany({
    where: {
      status: ScheduleStatus.PENDING,
      dueDate: { lt: today },
    },
    data: { status: ScheduleStatus.OVERDUE },
  });

  // Marcar los loans correspondientes
  const result = await prisma.loan.updateMany({
    where: {
      status: LoanStatus.ACTIVE,
      nextDueDate: { lt: today },
    },
    data: {
      status: LoanStatus.OVERDUE,
      updatedById: userId,
    },
  });

  return { affected: result.count };
}
