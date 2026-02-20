// ============================================================================
// LMS-Credit-Core: Módulo de Reportes PDF
// Archivo: lib/services/pdf-report.service.ts
// Descripción: Servicio que obtiene datos de la BD y genera reportes PDF
// ============================================================================

import { prisma } from "../db/prisma";
import { generateReciboPagoPDF, ReciboPagoData } from "@/lib/reports/recibo-pago";
import { generateEstadoCuentaPDF, EstadoCuentaData } from "@/lib/reports/estado-cuenta";
import { generatePlanPagosPDF, PlanPagosData } from "@/lib/reports/plan-pagos";
import { generateNotaPagarePDF, NotaPagareData } from "@/lib/reports/nota-pagare";
import { generateContratoPDF, ContratoData } from "@/lib/reports/contrato";
import { ServiceError } from "../errors";

// --- Configuración de la empresa ---
interface EmpresaConfig {
  nombre: string;
  direccion: string;
  telefono: string;
  rnc: string;
}

function getEmpresaConfig(): EmpresaConfig {
  return {
    nombre: process.env.EMPRESA_NOMBRE || 'LMS Credit Core SRL',
    direccion: process.env.EMPRESA_DIRECCION || 'Santo Domingo, D.N.',
    telefono: process.env.EMPRESA_TELEFONO || '(809) 555-0000',
    rnc: process.env.EMPRESA_RNC || '0-00-00000-0',
  };
}

// --- Utilidades de formato ---

function formatDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function getEsquemaLabel(frequency: string): string {
  const map: Record<string, string> = {
    DAILY: 'Diaria',
    WEEKLY: 'Semanal',
    BIWEEKLY: 'Quincenal',
    MONTHLY: 'Mensual',
  };
  return map[frequency] || 'Mensual';
}

function calculateFinalDueDate(startDate: Date, frequency: string, termCount: number): Date {
  const d = new Date(startDate);
  for (let i = 0; i < termCount; i++) {
    switch (frequency) {
      case 'DAILY': d.setDate(d.getDate() + 1); break;
      case 'WEEKLY': d.setDate(d.getDate() + 7); break;
      case 'BIWEEKLY': d.setDate(d.getDate() + 14); break;
      case 'MONTHLY': d.setMonth(d.getMonth() + 1); break;
    }
  }
  return d;
}

// ============================================================================
// RECIBO DE PAGO
// ============================================================================

export async function generateReciboPagoReport(paymentId: string): Promise<Buffer> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      loan: {
        include: {
          client: true,
        },
      },
    },
  });

  if (!payment) {
    throw new ServiceError('Pago no encontrado', 'PAYMENT_NOT_FOUND', 404);
  }

  const { loan } = payment;
  const { client } = loan;
  const empresa = getEmpresaConfig();

  const totalPagos = loan.termCount;

  const pagoNumero = await prisma.payment.count({
    where: {
      loanId: loan.id,
      paymentDate: { lte: payment.paymentDate },
    },
  });

  let diasRetraso = 0;
  if (loan.nextDueDate) {
    const dueDate = new Date(loan.nextDueDate);
    const payDate = new Date(payment.paymentDate);
    const diffTime = payDate.getTime() - dueDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    diasRetraso = Math.max(0, diffDays);
  }

  const remainingCapital = Number(loan.remainingCapital);

  const reciboPagoData: ReciboPagoData = {
    empresaNombre: empresa.nombre,
    empresaDireccion: empresa.direccion,
    empresaTelefono: empresa.telefono,
    empresaRnc: empresa.rnc,
    folio: pagoNumero,
    fechaExpedicion: formatDate(new Date()),
    fechaPago: formatDate(new Date(payment.paymentDate)),
    clienteNombre: `${client.firstName} ${client.lastName ?? ''}`.trim(),
    clienteNumero: client.documentId,
    clienteDomicilio: client.address || 'N/A',
    esquemaPago: getEsquemaLabel(loan.paymentFrequency),
    pagoNumero,
    totalPagos,
    cuotaNormal: Number(loan.installmentAmount),
    diasRetraso,
    cargoAtraso: Number(payment.lateFeeApplied),
    saldoVencido: Number(loan.installmentAmount),
    liquidacionPendiente: 0,
    liquidacionTotal: Math.max(0, remainingCapital),
    totalAPagar: Number(payment.totalAmount),
    pagoRecibido: Number(payment.totalAmount),
    saldoPendienteExcedente: 0,
  };

  return generateReciboPagoPDF(reciboPagoData);
}

// ============================================================================
// ESTADO DE CUENTA
// ============================================================================

export async function generateEstadoCuentaReport(loanId: string): Promise<Buffer> {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: {
      client: true,
      payments: {
        where: { totalAmount: { gt: 0 } },
        orderBy: { paymentDate: 'asc' },
        include: { createdBy: true },
      },
    },
  });

  if (!loan) {
    throw new ServiceError('Préstamo no encontrado', 'LOAN_NOT_FOUND', 404);
  }

  const { client } = loan;
  const empresa = getEmpresaConfig();

  let capitalPagado = 0;
  let interesPagado = 0;
  let moraPagada = 0;
  let runningBalance = Number(loan.principalAmount);

  const pagos = loan.payments.map((p) => {
    const capital = Number(p.capitalApplied);
    const interes = Number(p.interestApplied);
    const mora = Number(p.lateFeeApplied);
    runningBalance -= capital;
    capitalPagado += capital;
    interesPagado += interes;
    moraPagada += mora;

    return {
      fecha: formatDate(new Date(p.paymentDate)),
      monto: Number(p.totalAmount),
      capital,
      interes,
      mora,
      balance: Math.max(0, Math.round(runningBalance * 100) / 100),
      registradoPor: `${p.createdBy.firstName} ${p.createdBy.lastName}`,
    };
  });

  const data: EstadoCuentaData = {
    empresaNombre: empresa.nombre,
    empresaDireccion: empresa.direccion,
    empresaTelefono: empresa.telefono,
    empresaRnc: empresa.rnc,
    clienteNombre: `${client.firstName} ${client.lastName ?? ''}`.trim(),
    clienteDocumento: client.documentId,
    clienteTelefono: client.phone || 'N/A',
    clienteDireccion: client.address || 'N/A',
    prestamoId: loan.id,
    montoOriginal: Number(loan.principalAmount),
    tasaAnual: loan.annualInterestRate != null ? Number(loan.annualInterestRate) : undefined,
    totalFinanceCharge: loan.totalFinanceCharge != null ? Number(loan.totalFinanceCharge) : undefined,
    loanStructure: loan.loanStructure,
    frecuencia: getEsquemaLabel(loan.paymentFrequency),
    totalCuotas: loan.termCount,
    montoCuota: Number(loan.installmentAmount),
    fechaDesembolso: formatDate(new Date(loan.createdAt)),
    estado: loan.status,
    capitalPagado,
    interesPagado,
    moraPagada,
    capitalPendiente: Number(loan.remainingCapital),
    pagos,
  };

  return generateEstadoCuentaPDF(data);
}

// ============================================================================
// PLAN DE PAGOS
// ============================================================================

export async function generatePlanPagosReport(loanId: string): Promise<Buffer> {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: { client: true },
  });

  if (!loan) {
    throw new ServiceError('Préstamo no encontrado', 'LOAN_NOT_FOUND', 404);
  }

  const { client } = loan;
  const empresa = getEmpresaConfig();

  const data: PlanPagosData = {
    empresaNombre: empresa.nombre,
    empresaDireccion: empresa.direccion,
    empresaTelefono: empresa.telefono,
    empresaRnc: empresa.rnc,
    clienteNombre: `${client.firstName} ${client.lastName ?? ''}`.trim(),
    clienteDocumento: client.documentId,
    montoOriginal: Number(loan.principalAmount),
    tasaAnual: loan.annualInterestRate != null ? Number(loan.annualInterestRate) : undefined,
    totalFinanceCharge: loan.totalFinanceCharge != null ? Number(loan.totalFinanceCharge) : undefined,
    loanStructure: loan.loanStructure,
    frecuencia: getEsquemaLabel(loan.paymentFrequency),
    frecuenciaEnum: loan.paymentFrequency,
    totalCuotas: loan.termCount,
    montoCuota: Number(loan.installmentAmount),
    fechaInicio: formatDate(new Date(loan.createdAt)),
    estado: loan.status,
  };

  return generatePlanPagosPDF(data);
}

// ============================================================================
// NOTA DE PAGARÉ
// ============================================================================

export async function generateNotaPagareReport(loanId: string): Promise<Buffer> {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: { client: true },
  });

  if (!loan) {
    throw new ServiceError('Préstamo no encontrado', 'LOAN_NOT_FOUND', 404);
  }

  const { client } = loan;
  const empresa = getEmpresaConfig();
  const fechaVencimiento = calculateFinalDueDate(
    new Date(loan.createdAt), loan.paymentFrequency, loan.termCount
  );

  const data: NotaPagareData = {
    empresaNombre: empresa.nombre,
    empresaDireccion: empresa.direccion,
    empresaTelefono: empresa.telefono,
    empresaRnc: empresa.rnc,
    clienteNombre: `${client.firstName} ${client.lastName ?? ''}`.trim(),
    clienteDocumento: client.documentId,
    clienteDireccion: client.address || 'N/A',
    montoOriginal: Number(loan.principalAmount),
    tasaAnual: Number(loan.annualInterestRate),
    frecuencia: getEsquemaLabel(loan.paymentFrequency),
    totalCuotas: loan.termCount,
    montoCuota: Number(loan.installmentAmount),
    fechaDesembolso: formatDate(new Date(loan.createdAt)),
    fechaVencimiento: formatDate(fechaVencimiento),
  };

  return generateNotaPagarePDF(data);
}

// ============================================================================
// CONTRATO
// ============================================================================

export async function generateContratoReport(loanId: string): Promise<Buffer> {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: { client: true },
  });

  if (!loan) {
    throw new ServiceError('Préstamo no encontrado', 'LOAN_NOT_FOUND', 404);
  }

  const { client } = loan;
  const empresa = getEmpresaConfig();
  const fechaVencimiento = calculateFinalDueDate(
    new Date(loan.createdAt), loan.paymentFrequency, loan.termCount
  );

  const data: ContratoData = {
    empresaNombre: empresa.nombre,
    empresaDireccion: empresa.direccion,
    empresaTelefono: empresa.telefono,
    empresaRnc: empresa.rnc,
    clienteNombre: `${client.firstName} ${client.lastName ?? ''}`.trim(),
    clienteDocumento: client.documentId,
    clienteDireccion: client.address || 'N/A',
    clienteTelefono: client.phone || 'N/A',
    montoOriginal: Number(loan.principalAmount),
    tasaAnual: loan.annualInterestRate != null ? Number(loan.annualInterestRate) : undefined,
    totalFinanceCharge: loan.totalFinanceCharge != null ? Number(loan.totalFinanceCharge) : undefined,
    loanStructure: loan.loanStructure,
    frecuencia: getEsquemaLabel(loan.paymentFrequency),
    totalCuotas: loan.termCount,
    montoCuota: Number(loan.installmentAmount),
    fechaDesembolso: formatDate(new Date(loan.createdAt)),
    fechaVencimiento: formatDate(fechaVencimiento),
    garantias: loan.guarantees || '',
  };

  return generateContratoPDF(data);
}

// ============================================================================
// DISPATCHER
// ============================================================================

export type PdfReportType = 'recibo-pago' | 'estado-cuenta' | 'plan-pagos' | 'nota-pagare' | 'contrato';

export async function generatePdfReport(type: PdfReportType, entityId: string): Promise<Buffer> {
  switch (type) {
    case 'recibo-pago':
      return generateReciboPagoReport(entityId);
    case 'estado-cuenta':
      return generateEstadoCuentaReport(entityId);
    case 'plan-pagos':
      return generatePlanPagosReport(entityId);
    case 'nota-pagare':
      return generateNotaPagareReport(entityId);
    case 'contrato':
      return generateContratoReport(entityId);
    default:
      throw new ServiceError(`Tipo de reporte no soportado: ${type}`, 'INVALID_REPORT_TYPE', 400);
  }
}
