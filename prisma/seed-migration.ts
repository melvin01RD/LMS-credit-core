/**
 * SCRIPT DE MIGRACIÓN DE DATOS — LMS-Credit-Core
 * ================================================
 * Migra los 6 clientes activos desde Excel a Neon (producción).
 *
 * INSTRUCCIONES ANTES DE EJECUTAR:
 * 1. Hacer backup de Neon: Dashboard → Branch → Create backup
 * 2. Verificar que DATABASE_URL apunta al entorno correcto
 * 3. Ejecutar: npx tsx prisma/seed-migration.ts
 * 4. Rollback si algo falla post-commit: npx tsx prisma/seed-migration.ts --rollback
 *
 * ROLLBACK AUTOMÁTICO: La transacción principal se revierte sola si hay error.
 */

import {
  PrismaClient,
  LoanStatus,
  LoanStructure,
  PaymentFrequency,
  PaymentType,
  ScheduleStatus,
} from '@prisma/client'
import { addWeeks, subWeeks, isBefore, startOfDay } from 'date-fns'

const prisma = new PrismaClient({ log: ['error'] })

// ─── UTILIDADES ──────────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`)
}

function logError(msg: string, err?: unknown) {
  console.error(`[${new Date().toISOString()}] ❌ ERROR: ${msg}`, err ?? '')
}

function tempDocId(nombre: string): string {
  const slug = nombre.replace(/\s+/g, '').substring(0, 8).toUpperCase()
  const rand = Math.floor(Math.random() * 9000 + 1000)
  return `TEMP${slug}${rand}`
}

/**
 * Próximo día de semana a partir de hoy (nunca hoy mismo).
 */
function calcNextDueDate(diaPago: string): Date {
  const diasSemana: Record<string, number> = {
    lunes: 1, martes: 2, miercoles: 3, miércoles: 3,
    jueves: 4, viernes: 5, sabado: 6, sábado: 6, domingo: 0,
  }
  const targetDay = diasSemana[diaPago.toLowerCase()] ?? 5
  const hoy = new Date()
  const diff = (targetDay - hoy.getDay() + 7) % 7
  const next = new Date(hoy)
  next.setDate(hoy.getDate() + (diff === 0 ? 7 : diff))
  next.setHours(0, 0, 0, 0)
  return next
}

/**
 * startDate tal que addWeeks(startDate, installmentsPaid+1) == nextDueDate.
 * Garantiza que la próxima cuota pendiente caiga exactamente en nextDueDate.
 */
function calcStartDate(nextDueDate: Date, installmentsPaid: number): Date {
  return subWeeks(nextDueDate, installmentsPaid + 1)
}

/**
 * Genera el PaymentSchedule semanal.
 * startDate se normaliza a medianoche local para comparaciones limpias.
 */
function generateWeeklySchedule(params: {
  termCount: number
  installmentAmount: number
  principalAmount: number
  totalFinanceCharge: number
  startDate: Date
}) {
  const { termCount, installmentAmount, principalAmount, totalFinanceCharge } = params
  // Normalizar a medianoche local
  const startDate = startOfDay(new Date(params.startDate))

  const principalPerInstallment = Math.round((principalAmount / termCount) * 100) / 100
  const interestPerInstallment  = Math.round((totalFinanceCharge / termCount) * 100) / 100

  return Array.from({ length: termCount }, (_, idx) => {
    const i = idx + 1
    return {
      installmentNumber: i,
      dueDate: addWeeks(startDate, i),
      expectedAmount: installmentAmount,
      principalExpected: principalPerInstallment,
      interestExpected: interestPerInstallment,
    }
  })
}

// ─── PASO 0: OBTENER ADMIN ────────────────────────────────────────────────────

async function getAdminUserId(): Promise<string> {
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN', active: true },
    select: { id: true, email: true },
  })
  if (!admin) {
    throw new Error('No se encontró un usuario ADMIN activo.')
  }
  log(`✅ Admin: ${admin.email} (${admin.id})`)
  return admin.id
}

// ─── TIPOS ───────────────────────────────────────────────────────────────────

interface PagoData {
  paymentDate: Date
  totalAmount: number
  capitalApplied: number
  interestApplied: number
  lateFeeApplied: number
  installmentsCovered: number
  type: PaymentType
  createdById: string
}

// ─── DATOS ───────────────────────────────────────────────────────────────────

function buildDatos(adminId: string) {
  const nddViernes = calcNextDueDate('viernes')  // próximo viernes
  const nddSabado  = calcNextDueDate('sabado')   // próximo sábado
  const nddJueves  = calcNextDueDate('jueves')   // próximo jueves

  return [
    // ── 1. WANDA ──────────────────────────────────────────────────────────────
    // 25 semanas | RD$20,000/viernes | Capital: RD$150,000 | Total: RD$500,000
    // 1 pago histórico de RD$12,000 antes del acuerdo formal (no avanza schedule)
    {
      cliente: {
        firstName: 'Wanda',
        lastName: null as string | null,
        documentId: tempDocId('Wanda'),
        phone: '0000000000',
        address: null as string | null,
        email: null as string | null,
      },
      prestamo: {
        loanStructure:      LoanStructure.FLAT_RATE,
        principalAmount:    150_000,
        totalFinanceCharge: 350_000,
        totalPayableAmount: 500_000,
        annualInterestRate: null as number | null,
        paymentFrequency:   PaymentFrequency.WEEKLY,
        termCount:          25,
        installmentAmount:  20_000,
        installmentsPaid:   0,
        remainingCapital:   500_000,
        nextDueDate:        nddViernes,
        status:             LoanStatus.ACTIVE,
        guarantees:         'Acuerdo 25 semanas a RD$20,000/viernes. Cargo fijo: RD$350,000.',
        createdById:        adminId,
        startDate:          calcStartDate(nddViernes, 0),
      },
      pagos: [
        // Pago parcial previo al acuerdo formal — no cubre una cuota entera
        {
          paymentDate:       new Date('2026-02-22T10:00:00.000Z'),
          totalAmount:       12_000,
          capitalApplied:    0,
          interestApplied:   0,
          lateFeeApplied:    0,
          installmentsCovered: 0,
          type:              PaymentType.REGULAR,
          createdById:       adminId,
        },
      ],
    },

    // ── 2. ELIZBETH VASQUEZ ───────────────────────────────────────────────────
    // 26 semanas | RD$2,500/sábado | Capital: RD$50,000 | Total: RD$65,000
    {
      cliente: {
        firstName: 'Elizbeth',
        lastName: 'Vasquez' as string | null,
        documentId: tempDocId('ElizVasquez'),
        phone: '0000000000',
        address: null as string | null,
        email: null as string | null,
      },
      prestamo: {
        loanStructure:      LoanStructure.FLAT_RATE,
        principalAmount:    50_000,
        totalFinanceCharge: 15_000,
        totalPayableAmount: 65_000,
        annualInterestRate: null as number | null,
        paymentFrequency:   PaymentFrequency.WEEKLY,
        termCount:          26,
        installmentAmount:  2_500,
        installmentsPaid:   0,
        remainingCapital:   65_000,
        nextDueDate:        nddSabado,
        status:             LoanStatus.ACTIVE,
        guarantees:         'Pagaré firmado.',
        createdById:        adminId,
        startDate:          calcStartDate(nddSabado, 0),
      },
      pagos: [] as PagoData[],
    },

    // ── 3. DANIEL ARREDONDO ───────────────────────────────────────────────────
    // 13 semanas | RD$2,200/viernes | Capital: RD$20,000 | Total: RD$28,600
    // Cuota 1 pagada el 21/02/2026 | Garantía: moto Haojue
    {
      cliente: {
        firstName: 'Daniel',
        lastName: 'Arredondo' as string | null,
        documentId: tempDocId('DanielArr'),
        phone: '0000000000',
        address: null as string | null,
        email: null as string | null,
      },
      prestamo: {
        loanStructure:      LoanStructure.FLAT_RATE,
        principalAmount:    20_000,
        totalFinanceCharge: 8_600,
        totalPayableAmount: 28_600,
        annualInterestRate: null as number | null,
        paymentFrequency:   PaymentFrequency.WEEKLY,
        termCount:          13,
        installmentAmount:  2_200,
        installmentsPaid:   1,
        remainingCapital:   26_400,   // 28,600 − 2,200
        nextDueDate:        nddViernes,
        status:             LoanStatus.ACTIVE,
        guarantees:         'Garantía: motocicleta Haojue.',
        createdById:        adminId,
        startDate:          calcStartDate(nddViernes, 1),
      },
      pagos: [
        {
          paymentDate:       new Date('2026-02-21T10:00:00.000Z'),
          totalAmount:       2_200,
          capitalApplied:    0,
          interestApplied:   0,
          lateFeeApplied:    0,
          installmentsCovered: 1,
          type:              PaymentType.REGULAR,
          createdById:       adminId,
        },
      ],
    },

    // ── 4. RAFAEL CABRAL (Osiris) ─────────────────────────────────────────────
    // 8 semanas | RD$4,450/jueves | Capital: RD$25,000 | Total: RD$35,600
    // Sin pagos | OVERDUE | Cobranza: Bryant
    // startDate fijo 2026-02-12 → 4 cuotas vencidas al momento de migrar
    {
      cliente: {
        firstName: 'Rafael',
        lastName: 'Cabral' as string | null,
        documentId: tempDocId('RafaelCab'),
        phone: '0000000000',
        address: null as string | null,
        email: null as string | null,
      },
      prestamo: {
        loanStructure:      LoanStructure.FLAT_RATE,
        principalAmount:    25_000,
        totalFinanceCharge: 10_600,
        totalPayableAmount: 35_600,
        annualInterestRate: null as number | null,
        paymentFrequency:   PaymentFrequency.WEEKLY,
        termCount:          8,
        installmentAmount:  4_450,
        installmentsPaid:   0,
        remainingCapital:   35_600,
        nextDueDate:        new Date(2026, 1, 19, 0, 0, 0, 0),  // 2026-02-19 (primera cuota vencida)
        status:             LoanStatus.OVERDUE,
        guarantees:         'Apodo: Osiris. Cobranza a cargo de Bryant. Mora acumulada: RD$1,200.',
        createdById:        adminId,
        startDate:          new Date(2026, 1, 12, 0, 0, 0, 0),  // 2026-02-12 → da 4 cuotas vencidas
      },
      pagos: [] as PagoData[],
    },

    // ── 5. DARWIN ENMANUEL CORPORAN ───────────────────────────────────────────
    // 8 semanas | RD$3,500/jueves | Capital: RD$20,000 | Total: RD$28,000
    // Cuota 1 pagada 22/02/2026 + mora RD$1,000 | Cobranza: Bryant
    {
      cliente: {
        firstName: 'Darwin',
        lastName: 'Enmanuel Corporan' as string | null,
        documentId: tempDocId('DarwinCorp'),
        phone: '0000000000',
        address: null as string | null,
        email: null as string | null,
      },
      prestamo: {
        loanStructure:      LoanStructure.FLAT_RATE,
        principalAmount:    20_000,
        totalFinanceCharge: 8_000,
        totalPayableAmount: 28_000,
        annualInterestRate: null as number | null,
        paymentFrequency:   PaymentFrequency.WEEKLY,
        termCount:          8,
        installmentAmount:  3_500,
        installmentsPaid:   1,
        remainingCapital:   24_500,   // 28,000 − 3,500
        nextDueDate:        nddJueves,
        status:             LoanStatus.ACTIVE,
        guarantees:         'Cobranza a cargo de Bryant.',
        createdById:        adminId,
        startDate:          calcStartDate(nddJueves, 1),
      },
      pagos: [
        {
          paymentDate:       new Date('2026-02-22T10:00:00.000Z'),
          totalAmount:       4_500,   // 3,500 cuota + 1,000 mora
          capitalApplied:    0,
          interestApplied:   0,
          lateFeeApplied:    1_000,
          installmentsCovered: 1,
          type:              PaymentType.REGULAR,
          createdById:       adminId,
        },
      ],
    },

    // ── 6. VICTOR MANUEL ─────────────────────────────────────────────────────
    // 18 semanas | RD$2,500/sábado | Capital: RD$30,000 | Total: RD$45,000
    // Pagó RD$5,000 (2 cuotas adelantadas en un pago) | Cobranza: Bryant
    {
      cliente: {
        firstName: 'Victor',
        lastName: 'Manuel' as string | null,
        documentId: tempDocId('VictorMan'),
        phone: '0000000000',
        address: null as string | null,
        email: null as string | null,
      },
      prestamo: {
        loanStructure:      LoanStructure.FLAT_RATE,
        principalAmount:    30_000,
        totalFinanceCharge: 15_000,
        totalPayableAmount: 45_000,
        annualInterestRate: null as number | null,
        paymentFrequency:   PaymentFrequency.WEEKLY,
        termCount:          18,
        installmentAmount:  2_500,
        installmentsPaid:   2,
        remainingCapital:   40_000,   // 45,000 − 5,000
        nextDueDate:        nddSabado,
        status:             LoanStatus.ACTIVE,
        guarantees:         'Cobranza a cargo de Bryant.',
        createdById:        adminId,
        startDate:          calcStartDate(nddSabado, 2),
      },
      pagos: [
        {
          paymentDate:       new Date('2026-02-22T10:00:00.000Z'),
          totalAmount:       5_000,
          capitalApplied:    0,
          interestApplied:   0,
          lateFeeApplied:    0,
          installmentsCovered: 2,   // 2 cuotas en un solo pago
          type:              PaymentType.ADVANCE,
          createdById:       adminId,
        },
      ],
    },
  ]
}

// ─── VALIDACIÓN PRE-MIGRACIÓN ─────────────────────────────────────────────────

async function validarPreMigracion(datos: ReturnType<typeof buildDatos>) {
  log('🔍 Validando duplicados...')

  for (const d of datos) {
    // Verificar por nombre
    const existe = await prisma.client.findFirst({
      where: {
        firstName: d.cliente.firstName,
        lastName:  d.cliente.lastName ?? null,
      },
    })
    if (existe) {
      throw new Error(
        `Cliente "${d.cliente.firstName} ${d.cliente.lastName ?? ''}" ya existe (id: ${existe.id}). ` +
        `Abortando para evitar duplicados.`
      )
    }

    // Verificar colisión de documentId temporal (muy improbable pero seguro)
    const docExiste = await prisma.client.findUnique({
      where: { documentId: d.cliente.documentId },
    })
    if (docExiste) {
      // La colisión se resuelve en runtime — el campo es readonly en const,
      // así que solo advertimos (la probabilidad es ~1/9000)
      throw new Error(
        `Colisión de documentId temporal "${d.cliente.documentId}". ` +
        `Vuelve a ejecutar el script (se regenera automáticamente).`
      )
    }
  }

  log('✅ Sin duplicados detectados.')
}

// ─── INSERTAR UN CLIENTE COMPLETO ─────────────────────────────────────────────

async function insertarCliente(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  d: ReturnType<typeof buildDatos>[number],
  adminId: string
) {
  const nombre = `${d.cliente.firstName} ${d.cliente.lastName ?? ''}`.trim()
  log(`  → ${nombre}`)

  // 1. Cliente
  const cliente = await tx.client.create({
    data: {
      firstName:  d.cliente.firstName,
      lastName:   d.cliente.lastName  ?? undefined,
      documentId: d.cliente.documentId,
      phone:      d.cliente.phone,
      address:    d.cliente.address   ?? undefined,
      email:      d.cliente.email     ?? undefined,
    },
  })

  // 2. Préstamo (extraer startDate antes de pasar a Prisma)
  const { startDate, ...loanFields } = d.prestamo
  const prestamo = await tx.loan.create({
    data: {
      clientId: cliente.id,
      ...loanFields,
      annualInterestRate: loanFields.annualInterestRate ?? undefined,
    },
  })
  log(`     ✅ Préstamo ${prestamo.id} | ${prestamo.status}`)

  // 3. Pagos históricos
  type PagoInsertado = { paymentId: string; installmentsCovered: number; paymentDate: Date }
  const pagosInsertados: PagoInsertado[] = []

  for (const pago of d.pagos) {
    const payment = await tx.payment.create({
      data: {
        loanId:              prestamo.id,
        paymentDate:         pago.paymentDate,
        totalAmount:         pago.totalAmount,
        capitalApplied:      pago.capitalApplied,
        interestApplied:     pago.interestApplied,
        lateFeeApplied:      pago.lateFeeApplied,
        installmentsCovered: pago.installmentsCovered,
        type:                pago.type,
        createdById:         adminId,
      },
    })
    pagosInsertados.push({
      paymentId:           payment.id,
      installmentsCovered: pago.installmentsCovered,
      paymentDate:         pago.paymentDate,
    })
    log(`     💳 RD$${pago.totalAmount} (${pago.installmentsCovered} cuota(s)) — ${pago.paymentDate.toISOString().split('T')[0]}`)
  }

  // 4. PaymentSchedule
  // Mapear installmentNumber → paymentId para las cuotas cubiertas
  const pagosPorCuota = new Map<number, PagoInsertado>()
  let cuotaAcum = 0
  for (const p of pagosInsertados) {
    for (let j = 0; j < p.installmentsCovered; j++) {
      cuotaAcum++
      pagosPorCuota.set(cuotaAcum, p)
    }
  }

  const hoy = startOfDay(new Date())
  const schedule = generateWeeklySchedule({
    termCount:          loanFields.termCount,
    installmentAmount:  Number(loanFields.installmentAmount),
    principalAmount:    Number(loanFields.principalAmount),
    totalFinanceCharge: Number(loanFields.totalFinanceCharge),
    startDate,
  })

  const scheduleData = schedule.map((entry) => {
    const pagoInfo = pagosPorCuota.get(entry.installmentNumber)
    const isPaid   = !!pagoInfo
    const isOverdue = !isPaid && isBefore(entry.dueDate, hoy)

    const base = {
      loanId:            prestamo.id,
      installmentNumber: entry.installmentNumber,
      dueDate:           entry.dueDate,
      expectedAmount:    entry.expectedAmount,
      principalExpected: entry.principalExpected,
      interestExpected:  entry.interestExpected,
    }

    if (isPaid) {
      return {
        ...base,
        status:    ScheduleStatus.PAID,
        paidAt:    pagoInfo!.paymentDate,
        paymentId: pagoInfo!.paymentId,
      }
    }
    if (isOverdue) {
      return { ...base, status: ScheduleStatus.OVERDUE }
    }
    return { ...base, status: ScheduleStatus.PENDING }
  })

  await tx.paymentSchedule.createMany({ data: scheduleData })

  const nPaid    = scheduleData.filter(s => s.status === ScheduleStatus.PAID).length
  const nOverdue = scheduleData.filter(s => s.status === ScheduleStatus.OVERDUE).length
  const nPending = scheduleData.length - nPaid - nOverdue
  log(`     📅 Schedule: ${nPaid} pagadas | ${nOverdue} vencidas | ${nPending} pendientes`)

  return {
    cliente:           nombre,
    clienteId:         cliente.id,
    prestamoId:        prestamo.id,
    pagosInsertados:   pagosInsertados.length,
    status:            prestamo.status,
    documentIdTemporal: d.cliente.documentId,
  }
}

// ─── MIGRACIÓN PRINCIPAL ──────────────────────────────────────────────────────

async function migrar() {
  log('═══════════════════════════════════════════════════════')
  log('  INICIO MIGRACIÓN — LMS-Credit-Core → Neon Producción')
  log('═══════════════════════════════════════════════════════')

  const adminId = await getAdminUserId()
  const datos   = buildDatos(adminId)

  await validarPreMigracion(datos)

  log('🚀 Iniciando transacción...')

  const resultado = await prisma.$transaction(async (tx) => {
    const resumen = []
    for (const d of datos) {
      resumen.push(await insertarCliente(tx, d, adminId))
    }
    return resumen
  })

  log('')
  log('─────────────────────────────────────────────────────────────────────')
  log('  CLIENTE                    | STATUS   | PAGOS | DOC_ID_TEMP')
  log('─────────────────────────────────────────────────────────────────────')
  for (const r of resultado) {
    const nombre = r.cliente.padEnd(26)
    const status = r.status.padEnd(8)
    const pagos  = String(r.pagosInsertados).padEnd(5)
    log(`  ${nombre} | ${status} | ${pagos} | ${r.documentIdTemporal}`)
  }
  log('─────────────────────────────────────────────────────────────────────')
  log('')
  log('⚠️  ACCIONES PENDIENTES POST-MIGRACIÓN:')
  log('   1. Editar cada cliente: reemplazar documentId TEMP-* con cédula real')
  log('   2. Actualizar teléfonos y direcciones')
  log('   3. Verificar nextDueDate de cada préstamo en el dashboard')
  log('   4. Confirmar status OVERDUE de Rafael Cabral (Osiris)')
  log('')
  log('🔗 IDs para referencia:')
  for (const r of resultado) {
    log(`   ${r.cliente.padEnd(26)} clienteId=${r.clienteId} | prestamoId=${r.prestamoId}`)
  }
  log('')
  log('✅ Migración completada exitosamente.')
}

// ─── ROLLBACK ─────────────────────────────────────────────────────────────────
// Usar solo si la transacción completó pero los datos tienen errores.
// Elimina todo lo creado por esta migración (clientes con documentId TEMP-*).

async function rollback() {
  log('⚠️  ROLLBACK — Eliminando clientes TEMP migrados...')

  const tempClientes = await prisma.client.findMany({
    where: { documentId: { startsWith: 'TEMP' } },
    include: {
      loans: {
        include: {
          payments:        true,
          paymentSchedule: true,
        },
      },
    },
  })

  if (tempClientes.length === 0) {
    log('ℹ️  No se encontraron clientes TEMP. Nada que revertir.')
    return
  }

  for (const c of tempClientes) {
    for (const loan of c.loans) {
      await prisma.paymentSchedule.deleteMany({ where: { loanId: loan.id } })
      await prisma.payment.deleteMany({ where: { loanId: loan.id } })
      await prisma.loan.delete({ where: { id: loan.id } })
    }
    await prisma.client.delete({ where: { id: c.id } })
    log(`  🗑️  Eliminado: ${c.firstName} ${c.lastName ?? ''} (${c.id})`)
  }

  log('✅ Rollback completado.')
}

// ─── ENTRY POINT ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2)

if (args[0] === '--rollback') {
  rollback()
    .catch(e => { logError('Rollback fallido', e); process.exit(1) })
    .finally(() => prisma.$disconnect())
} else {
  migrar()
    .catch(e => { logError('Migración fallida — transacción revertida', e); process.exit(1) })
    .finally(() => prisma.$disconnect())
}
