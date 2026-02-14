import { prisma } from "../db/prisma";
import { LoanStatus } from "@prisma/client";

// ============================================
// INTERFACES
// ============================================

export interface DashboardMetrics {
  totalLoaned: number;
  totalOutstanding: number;
  totalInterest: number;
  totalLateFees: number;
  activeClients: number;
  activeLoans: number;
  overdueLoans: number;
  paidLoans: number;
  paymentsThisMonth: number;
  paymentsThisMonthAmount: number;
  loansByMonth: MonthlyLoanData[];
  paymentsByMonth: MonthlyPaymentData[];
  portfolioDistribution: PortfolioDistribution[];
  upcomingPayments: UpcomingPayment[];
}

export interface MonthlyLoanData {
  month: string;
  count: number;
  amount: number;
}

export interface MonthlyPaymentData {
  month: string;
  count: number;
  amount: number;
  capital: number;
  interest: number;
}

export interface PortfolioDistribution {
  status: string;
  count: number;
  percentage: number;
  amount: number;
}

export interface UpcomingPayment {
  loanId: string;
  clientName: string;
  clientDocument: string;
  dueDate: Date;
  installmentAmount: number;
  daysUntilDue: number;
}

// ============================================
// DASHBOARD METRICS
// ============================================

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

  // Consultas en paralelo para mejor performance
  const [
    loans,
    payments,
    paymentsThisMonth,
    activeClientsCount,
  ] = await Promise.all([
    // Todos los préstamos con aggregations
    prisma.loan.findMany({
      select: {
        id: true,
        principalAmount: true,
        remainingCapital: true,
        status: true,
        createdAt: true,
        nextDueDate: true,
        installmentAmount: true,
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            documentId: true,
          },
        },
      },
    }),

    // Todos los pagos con aggregations
    prisma.payment.findMany({
      select: {
        totalAmount: true,
        capitalApplied: true,
        interestApplied: true,
        lateFeeApplied: true,
        paymentDate: true,
      },
    }),

    // Pagos de este mes
    prisma.payment.findMany({
      where: {
        paymentDate: {
          gte: startOfMonth,
        },
      },
      select: {
        totalAmount: true,
      },
    }),

    // Clientes activos (con préstamos activos o en mora)
    prisma.client.count({
      where: {
        active: true,
        loans: {
          some: {
            status: {
              in: [LoanStatus.ACTIVE, LoanStatus.OVERDUE],
            },
          },
        },
      },
    }),
  ]);

  // Calcular métricas principales
  const totalLoaned = loans.reduce((sum, l) => sum + Number(l.principalAmount), 0);
  const totalOutstanding = loans
    .filter((l) => l.status === LoanStatus.ACTIVE || l.status === LoanStatus.OVERDUE)
    .reduce((sum, l) => sum + Number(l.remainingCapital), 0);

  const totalInterest = payments.reduce((sum, p) => sum + Number(p.interestApplied), 0);
  const totalLateFees = payments.reduce((sum, p) => sum + Number(p.lateFeeApplied), 0);

  const activeLoans = loans.filter((l) => l.status === LoanStatus.ACTIVE).length;
  const overdueLoans = loans.filter((l) => l.status === LoanStatus.OVERDUE).length;
  const paidLoans = loans.filter((l) => l.status === LoanStatus.PAID).length;

  const paymentsThisMonthAmount = paymentsThisMonth.reduce(
    (sum, p) => sum + Number(p.totalAmount),
    0
  );

  // Préstamos por mes (últimos 6 meses)
  const loansByMonth = generateMonthlyLoanData(loans, sixMonthsAgo);

  // Pagos por mes (últimos 6 meses)
  const paymentsByMonth = generateMonthlyPaymentData(payments, sixMonthsAgo);

  // Distribución de cartera
  const portfolioDistribution = calculatePortfolioDistribution(loans);

  // Próximos pagos (próximos 7 días)
  const upcomingPayments = getUpcomingPayments(loans);

  return {
    totalLoaned,
    totalOutstanding,
    totalInterest,
    totalLateFees,
    activeClients: activeClientsCount,
    activeLoans,
    overdueLoans,
    paidLoans,
    paymentsThisMonth: paymentsThisMonth.length,
    paymentsThisMonthAmount,
    loansByMonth,
    paymentsByMonth,
    portfolioDistribution,
    upcomingPayments,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateMonthlyLoanData(
  loans: any[],
  startDate: Date
): MonthlyLoanData[] {
  const monthlyData = new Map<string, { count: number; amount: number }>();

  loans
    .filter((l) => new Date(l.createdAt) >= startDate)
    .forEach((loan) => {
      const monthKey = new Date(loan.createdAt).toLocaleDateString("es-DO", {
        year: "numeric",
        month: "short",
      });

      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, { count: 0, amount: 0 });
      }

      const data = monthlyData.get(monthKey)!;
      data.count++;
      data.amount += Number(loan.principalAmount);
    });

  // Convertir a array y ordenar por fecha
  const result: MonthlyLoanData[] = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = date.toLocaleDateString("es-DO", {
      year: "numeric",
      month: "short",
    });

    const data = monthlyData.get(monthKey) || { count: 0, amount: 0 };
    result.push({
      month: date.toLocaleDateString("es-DO", { month: "short" }),
      count: data.count,
      amount: data.amount,
    });
  }

  return result;
}

function generateMonthlyPaymentData(
  payments: any[],
  startDate: Date
): MonthlyPaymentData[] {
  const monthlyData = new Map<
    string,
    { count: number; amount: number; capital: number; interest: number }
  >();

  payments
    .filter((p) => new Date(p.paymentDate) >= startDate)
    .forEach((payment) => {
      const monthKey = new Date(payment.paymentDate).toLocaleDateString("es-DO", {
        year: "numeric",
        month: "short",
      });

      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, { count: 0, amount: 0, capital: 0, interest: 0 });
      }

      const data = monthlyData.get(monthKey)!;
      data.count++;
      data.amount += Number(payment.totalAmount);
      data.capital += Number(payment.capitalApplied);
      data.interest += Number(payment.interestApplied);
    });

  // Convertir a array y ordenar por fecha
  const result: MonthlyPaymentData[] = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = date.toLocaleDateString("es-DO", {
      year: "numeric",
      month: "short",
    });

    const data = monthlyData.get(monthKey) || { count: 0, amount: 0, capital: 0, interest: 0 };
    result.push({
      month: date.toLocaleDateString("es-DO", { month: "short" }),
      count: data.count,
      amount: data.amount,
      capital: data.capital,
      interest: data.interest,
    });
  }

  return result;
}

function calculatePortfolioDistribution(loans: any[]): PortfolioDistribution[] {
  const total = loans.length;
  const distribution = new Map<string, { count: number; amount: number }>();

  const statusLabels: Record<string, string> = {
    ACTIVE: "Activos",
    OVERDUE: "En Mora",
    PAID: "Pagados",
    CANCELED: "Cancelados",
  };

  loans.forEach((loan) => {
    const status = loan.status;
    if (!distribution.has(status)) {
      distribution.set(status, { count: 0, amount: 0 });
    }

    const data = distribution.get(status)!;
    data.count++;
    data.amount += Number(
      status === LoanStatus.PAID ? loan.principalAmount : loan.remainingCapital
    );
  });

  return Array.from(distribution.entries()).map(([status, data]) => ({
    status: statusLabels[status] || status,
    count: data.count,
    percentage: total > 0 ? (data.count / total) * 100 : 0,
    amount: data.amount,
  }));
}

function getUpcomingPayments(loans: any[]): UpcomingPayment[] {
  const now = new Date();
  const sevenDaysLater = new Date(now);
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

  return loans
    .filter(
      (l) =>
        l.nextDueDate &&
        (l.status === LoanStatus.ACTIVE || l.status === LoanStatus.OVERDUE) &&
        new Date(l.nextDueDate) <= sevenDaysLater
    )
    .map((loan) => {
      const dueDate = new Date(loan.nextDueDate);
      const daysUntilDue = Math.ceil(
        (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        loanId: loan.id,
        clientName: `${loan.client.firstName} ${loan.client.lastName || ""}`.trim(),
        clientDocument: loan.client.documentId,
        dueDate,
        installmentAmount: Number(loan.installmentAmount),
        daysUntilDue,
      };
    })
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
    .slice(0, 10); // Top 10
}
