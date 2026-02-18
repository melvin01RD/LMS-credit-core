// ============================================================================
// LMS-Credit-Core: Servicio de Cartera Vigente
// Archivo: lib/services/cartera-vigente.service.ts
// Descripcion: Obtiene prestamos activos y en mora con totales consolidados
// ============================================================================

import { prisma } from "../db/prisma";

// --- Tipos exportados ---

export interface LoanEntry {
  clienteNombre: string;
  clienteCedula: string;
  montoOriginal: number;
  capitalRestante: number;
  capitalRecuperado: number;
  cuotasPagadas: number;
  totalCuotas: number;
  proximoVencimiento: string | null;
  estado: 'ACTIVE' | 'OVERDUE';
}

export interface TotalesCartera {
  totalCapitalEnLaCalle: number;
  totalCapitalOriginal: number;
  totalCapitalRecuperado: number;
  cantidadActivos: number;
  cantidadEnMora: number;
  totalEnRiesgo: number;
}

export interface CarteraVigenteData {
  prestamos: LoanEntry[];
  totales: TotalesCartera;
  fechaGeneracion: string;
  empresaNombre: string;
  empresaDireccion: string;
  empresaTelefono: string;
  empresaRnc: string;
}

// --- Utilidades ---

function formatDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function getEmpresaConfig() {
  return {
    nombre: process.env.EMPRESA_NOMBRE || 'LMS Credit Core SRL',
    direccion: process.env.EMPRESA_DIRECCION || 'Santo Domingo, D.N.',
    telefono: process.env.EMPRESA_TELEFONO || '(809) 555-0000',
    rnc: process.env.EMPRESA_RNC || '0-00-00000-0',
  };
}

// ============================================================================
// SERVICIO PRINCIPAL
// ============================================================================

export async function getCarteraVigente(): Promise<CarteraVigenteData> {
  const empresa = getEmpresaConfig();

  const loans = await prisma.loan.findMany({
    where: {
      status: { in: ['ACTIVE', 'OVERDUE'] },
    },
    include: {
      client: true,
      _count: {
        select: {
          payments: {
            where: { type: 'REGULAR' },
          },
        },
      },
    },
    orderBy: [
      { status: 'asc' },
      { client: { lastName: 'asc' } },
    ],
  });

  const prestamos: LoanEntry[] = loans.map((loan) => {
    const montoOriginal = Number(loan.principalAmount);
    const capitalRestante = Number(loan.remainingCapital);
    const capitalRecuperado = Math.max(0, montoOriginal - capitalRestante);

    return {
      clienteNombre: `${loan.client.firstName} ${loan.client.lastName ?? ''}`.trim(),
      clienteCedula: loan.client.documentId,
      montoOriginal,
      capitalRestante,
      capitalRecuperado,
      cuotasPagadas: loan._count.payments,
      totalCuotas: loan.termCount,
      proximoVencimiento: loan.nextDueDate ? formatDate(new Date(loan.nextDueDate)) : null,
      estado: loan.status as 'ACTIVE' | 'OVERDUE',
    };
  });

  const cantidadActivos = prestamos.filter((p) => p.estado === 'ACTIVE').length;
  const cantidadEnMora = prestamos.filter((p) => p.estado === 'OVERDUE').length;
  const totalCapitalEnLaCalle = prestamos.reduce((sum, p) => sum + p.capitalRestante, 0);
  const totalCapitalOriginal = prestamos.reduce((sum, p) => sum + p.montoOriginal, 0);
  const totalCapitalRecuperado = prestamos.reduce((sum, p) => sum + p.capitalRecuperado, 0);
  const totalEnRiesgo = prestamos
    .filter((p) => p.estado === 'OVERDUE')
    .reduce((sum, p) => sum + p.capitalRestante, 0);

  return {
    prestamos,
    totales: {
      totalCapitalEnLaCalle,
      totalCapitalOriginal,
      totalCapitalRecuperado,
      cantidadActivos,
      cantidadEnMora,
      totalEnRiesgo,
    },
    fechaGeneracion: formatDate(new Date()),
    empresaNombre: empresa.nombre,
    empresaDireccion: empresa.direccion,
    empresaTelefono: empresa.telefono,
    empresaRnc: empresa.rnc,
  };
}
