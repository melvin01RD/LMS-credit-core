import { vi } from "vitest";

// Mock de autenticación — sesión válida por defecto
vi.mock("@/lib/auth", () => ({
  getSession: vi.fn().mockResolvedValue({
    userId: "user-1",
    email: "admin@test.com",
    firstName: "Admin",
    lastName: "User",
    role: "ADMIN",
  }),
  createSession: vi.fn().mockResolvedValue(undefined),
  destroySession: vi.fn().mockResolvedValue(undefined),
}));

// Mock de servicios — sin vi.importActual para evitar cargar Prisma real
vi.mock("@/lib/services", () => ({
  // Clients
  getClients: vi.fn(),
  createClient: vi.fn(),
  getClientById: vi.fn(),
  updateClient: vi.fn(),
  deactivateClient: vi.fn(),
  deleteClient: vi.fn(),
  searchClients: vi.fn(),
  // Loans
  getLoans: vi.fn(),
  createLoan: vi.fn(),
  getLoanById: vi.fn(),
  cancelLoan: vi.fn(),
  markLoanAsOverdue: vi.fn(),
  getLoanAmortization: vi.fn(),
  getLoanSchedule: vi.fn(),
  getLoanSummary: vi.fn(),
  getLoanPayments: vi.fn(),
  getOverdueLoans: vi.fn(),
  processOverdueLoans: vi.fn(),
  // Payments
  createPayment: vi.fn(),
  reversePayment: vi.fn(),
  getPaymentById: vi.fn(),
  getPayments: vi.fn(),
  getPaymentsByLoan: vi.fn(),
  getPaymentsSummary: vi.fn(),
  // Audit
  auditLog: vi.fn().mockResolvedValue(undefined),
  AuditAction: {
    CREATE_CLIENT: "CREATE_CLIENT",
    UPDATE_CLIENT: "UPDATE_CLIENT",
    DELETE_CLIENT: "DELETE_CLIENT",
    CREATE_LOAN: "CREATE_LOAN",
    CANCEL_LOAN: "CANCEL_LOAN",
    REGISTER_PAYMENT: "REGISTER_PAYMENT",
    REVERSE_PAYMENT: "REVERSE_PAYMENT",
  },
  AuditEntity: {
    CLIENT: "CLIENT",
    LOAN: "LOAN",
    PAYMENT: "PAYMENT",
  },
}));
