import { prisma } from "@/lib/db/prisma";
import { LoanStatus, PaymentFrequency } from "@prisma/client";

interface CreateLoanInput {
  clientId: string;
  principalAmount: number;
  annualInterestRate: number;
  paymentFrequency: PaymentFrequency;
  termCount: number;
  createdById: string;
  guarantees?: string;
}

export async function createLoan(data: CreateLoanInput) {
  const installmentAmount =
    data.principalAmount / data.termCount;

  return prisma.loan.create({
    data: {
      clientId: data.clientId,

      principalAmount: data.principalAmount,
      annualInterestRate: data.annualInterestRate,
      paymentFrequency: data.paymentFrequency,
      termCount: data.termCount,

      installmentAmount,
      remainingCapital: data.principalAmount,

      status: LoanStatus.ACTIVE,
      guarantees: data.guarantees,

      createdById: data.createdById,
    },
  });
}
