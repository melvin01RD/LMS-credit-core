import { describe, it, expect, vi, beforeEach } from "vitest";
import "./setup";
import { getDashboardMetrics } from "../../../lib/services/reports.service";
import { LoanStatus } from "@prisma/client";
import { prismaMock } from "./prisma.mock";

// ============================================
// Helpers
// ============================================

const createReportLoan = (overrides: Record<string, any> = {}) => ({
  id: "loan-1",
  principalAmount: 10000,
  remainingCapital: 8000,
  status: LoanStatus.ACTIVE,
  createdAt: new Date(),
  nextDueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
  installmentAmount: 942.52,
  client: {
    id: "client-1",
    firstName: "Juan",
    lastName: "Pérez",
    documentId: "001-1234567-8",
  },
  ...overrides,
});

function setupEmptyPayments() {
  prismaMock.payment.findMany
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([]);
  prismaMock.client.count.mockResolvedValue(0);
}

// ============================================
// Branch: `statusLabels[status] || status`
// Lines 304-306 — status without a known label
// ============================================

describe("getDashboardMetrics - portfolio distribution branch coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("usa el status literal cuando no hay etiqueta conocida para ese status", async () => {
    // Inject a loan with an unknown status to hit `statusLabels[status] || status`
    const loans = [
      createReportLoan({ status: "UNKNOWN_STATUS" as any }),
    ];

    prismaMock.loan.findMany.mockResolvedValue(loans);
    setupEmptyPayments();

    const result = await getDashboardMetrics();

    // The distribution entry should use the raw status as label
    const unknownEntry = result.portfolioDistribution.find(
      (d) => d.status === "UNKNOWN_STATUS"
    );
    expect(unknownEntry).toBeDefined();
    expect(unknownEntry!.count).toBe(1);
  });

  it("incluye préstamos CANCELED en la distribución con etiqueta correcta", async () => {
    const loans = [
      createReportLoan({ id: "loan-1", status: LoanStatus.ACTIVE }),
      createReportLoan({ id: "loan-2", status: LoanStatus.CANCELED, remainingCapital: 5000 }),
    ];

    prismaMock.loan.findMany.mockResolvedValue(loans);
    setupEmptyPayments();

    const result = await getDashboardMetrics();

    const canceledEntry = result.portfolioDistribution.find((d) => d.status === "Cancelados");
    expect(canceledEntry).toBeDefined();
    expect(canceledEntry!.count).toBe(1);
  });
});

// ============================================
// Branch: `loan.client.lastName || ""`
// Line 331 — loan without lastName in upcoming payments
// ============================================

describe("getDashboardMetrics - upcoming payments sin lastName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clientName queda solo con firstName cuando lastName es null", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const loans = [
      createReportLoan({
        id: "loan-1",
        status: LoanStatus.ACTIVE,
        nextDueDate: tomorrow,
        installmentAmount: 500,
        client: {
          id: "client-1",
          firstName: "Juan",
          lastName: null,
          documentId: "001-1234567-8",
        },
      }),
    ];

    prismaMock.loan.findMany.mockResolvedValue(loans);
    setupEmptyPayments();

    const result = await getDashboardMetrics();

    expect(result.upcomingPayments).toHaveLength(1);
    // trim() removes trailing space from `${firstName} ${null || ""}`
    expect(result.upcomingPayments[0].clientName).toBe("Juan");
  });

  it("clientName usa firstName + lastName cuando ambos existen", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const loans = [
      createReportLoan({
        status: LoanStatus.ACTIVE,
        nextDueDate: tomorrow,
        installmentAmount: 500,
        client: {
          id: "client-1",
          firstName: "María",
          lastName: "González",
          documentId: "001-0000001-0",
        },
      }),
    ];

    prismaMock.loan.findMany.mockResolvedValue(loans);
    setupEmptyPayments();

    const result = await getDashboardMetrics();

    expect(result.upcomingPayments[0].clientName).toBe("María González");
  });
});
