# Guía de Migración — Soporte Flat Rate (DAILY / WEEKLY)

## Resumen de cambios

### Enums modificados
- `PaymentFrequency`: agregado `DAILY`
- `PaymentType`: agregado `ADVANCE`
- `LoanStructure` (NUEVO): `FRENCH_AMORTIZATION` | `FLAT_RATE`
- `ScheduleStatus` (NUEVO): `PENDING` | `PAID` | `OVERDUE` | `ADVANCE_PAID`

### Modelos modificados
- `Loan`: campos nuevos no-obligatorios (compatibilidad retroactiva)
- `Payment`: campo `installmentsCovered` con default 1

### Modelos nuevos
- `PaymentSchedule`: plan de cuotas persistido en DB

---

## Paso 1 — Aplicar el schema

Reemplaza tu `prisma/schema.prisma` con el nuevo schema y corre:

```bash
npx prisma migrate dev --name add_flat_rate_support
```

---

## Paso 2 — Verificar la migración generada

La migración debe incluir exactamente esto (verifica antes de aplicar en producción):

```sql
-- Nuevos ENUMs
ALTER TYPE "PaymentFrequency" ADD VALUE 'DAILY';
ALTER TYPE "PaymentType" ADD VALUE 'ADVANCE';
CREATE TYPE "LoanStructure" AS ENUM ('FRENCH_AMORTIZATION', 'FLAT_RATE');
CREATE TYPE "ScheduleStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'ADVANCE_PAID');

-- Nuevas columnas en Loan (todas nullable o con default — no rompen datos existentes)
ALTER TABLE "Loan" ADD COLUMN "loanStructure" "LoanStructure" NOT NULL DEFAULT 'FRENCH_AMORTIZATION';
ALTER TABLE "Loan" ADD COLUMN "totalFinanceCharge" DECIMAL(12,2);
ALTER TABLE "Loan" ADD COLUMN "totalPayableAmount" DECIMAL(12,2);
ALTER TABLE "Loan" ADD COLUMN "installmentsPaid" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Loan" ALTER COLUMN "annualInterestRate" DROP NOT NULL;

-- Nueva columna en Payment
ALTER TABLE "Payment" ADD COLUMN "installmentsCovered" INTEGER NOT NULL DEFAULT 1;

-- Nueva tabla PaymentSchedule
CREATE TABLE "PaymentSchedule" (
  "id" TEXT NOT NULL,
  "loanId" TEXT NOT NULL,
  "installmentNumber" INTEGER NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "expectedAmount" DECIMAL(12,2) NOT NULL,
  "principalExpected" DECIMAL(12,2) NOT NULL,
  "interestExpected" DECIMAL(12,2) NOT NULL,
  "status" "ScheduleStatus" NOT NULL DEFAULT 'PENDING',
  "paidAt" TIMESTAMP(3),
  "paymentId" TEXT,
  CONSTRAINT "PaymentSchedule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentSchedule_loanId_idx" ON "PaymentSchedule"("loanId");
CREATE INDEX "PaymentSchedule_dueDate_idx" ON "PaymentSchedule"("dueDate");
CREATE INDEX "PaymentSchedule_status_idx" ON "PaymentSchedule"("status");
CREATE INDEX "PaymentSchedule_loanId_installmentNumber_idx" ON "PaymentSchedule"("loanId", "installmentNumber");

ALTER TABLE "PaymentSchedule" ADD CONSTRAINT "PaymentSchedule_loanId_fkey"
  FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

---

## Paso 3 — Migrar préstamos existentes (datos)

Los préstamos existentes son todos French. Después de la migración, ejecuta este script
para generar su PaymentSchedule en DB (antes no existía esta tabla):

```typescript
// scripts/migrate-existing-schedules.ts
// Ejecutar UNA SOLA VEZ después de la migración

import { prisma } from "../src/lib/db/prisma";
import { generateAmortizationSchedule } from "../src/lib/domain/loan";
import { ScheduleStatus } from "@prisma/client";

async function migrateExistingSchedules() {
  const loans = await prisma.loan.findMany({
    where: {
      loanStructure: "FRENCH_AMORTIZATION",
      paymentSchedule: { none: {} }, // solo los que no tienen schedule aún
    },
    include: { payments: { orderBy: { paymentDate: "asc" } } },
  });

  console.log(`Migrando ${loans.length} préstamos...`);

  for (const loan of loans) {
    const schedule = generateAmortizationSchedule(
      Number(loan.principalAmount),
      Number(loan.annualInterestRate),
      loan.termCount,
      loan.paymentFrequency,
      loan.createdAt
    );

    // Determinar cuáles cuotas ya están pagadas basándose en payments existentes
    const paidCount = loan.payments.filter((p) => Number(p.totalAmount) > 0).length;

    await prisma.paymentSchedule.createMany({
      data: schedule.map((entry, index) => ({
        loanId: loan.id,
        installmentNumber: index + 1,
        dueDate: entry.dueDate,
        expectedAmount: entry.payment,
        principalExpected: entry.principal,
        interestExpected: entry.interest,
        status: index < paidCount ? ScheduleStatus.PAID : ScheduleStatus.PENDING,
        paidAt: index < paidCount ? loan.payments[index]?.paymentDate : null,
        paymentId: index < paidCount ? loan.payments[index]?.id : null,
      })),
    });

    console.log(`  ✓ Loan ${loan.id} — ${schedule.length} cuotas generadas (${paidCount} pagadas)`);
  }

  console.log("Migración completada.");
}

migrateExistingSchedules()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Ejecutar con:
```bash
npx ts-node scripts/migrate-existing-schedules.ts
```

---

## Paso 4 — Reemplazar servicios

| Archivo origen | Destino en tu proyecto |
|----------------|----------------------|
| `flatRateCalculator.ts` | `src/lib/domain/flatRateCalculator.ts` |
| `loan.service.extended.ts` | `src/lib/services/loan.service.ts` |
| `payment.service.extended.ts` | `src/lib/services/payment.service.ts` |

---

## Paso 5 — Actualizar API Routes

### POST /api/loans — nueva estructura del body

**Antes (solo francés):**
```json
{
  "clientId": "uuid",
  "principalAmount": 56000,
  "annualInterestRate": 8,
  "paymentFrequency": "MONTHLY",
  "termCount": 12
}
```

**Ahora — Francés:**
```json
{
  "loanStructure": "FRENCH_AMORTIZATION",
  "clientId": "uuid",
  "principalAmount": 56000,
  "annualInterestRate": 8,
  "paymentFrequency": "MONTHLY",
  "termCount": 12
}
```

**Ahora — Flat Rate Diario:**
```json
{
  "loanStructure": "FLAT_RATE",
  "clientId": "uuid",
  "principalAmount": 10000,
  "totalFinanceCharge": 3500,
  "paymentFrequency": "DAILY",
  "termCount": 45
}
```

**Ahora — Flat Rate Semanal:**
```json
{
  "loanStructure": "FLAT_RATE",
  "clientId": "uuid",
  "principalAmount": 10000,
  "totalFinanceCharge": 2000,
  "paymentFrequency": "WEEKLY",
  "termCount": 8
}
```

### Retrocompatibilidad
Si `loanStructure` no viene en el body, defaultea a `FRENCH_AMORTIZATION`:
```typescript
const loanStructure = data.loanStructure ?? "FRENCH_AMORTIZATION";
```

---

## Paso 6 — Verificar que nada se rompió

```bash
# Correr tests existentes — deben pasar todos
npx jest --testPathPattern="loan|payment"

# Crear un préstamo francés de prueba (debe funcionar igual)
curl -X POST /api/loans -d '{
  "loanStructure": "FRENCH_AMORTIZATION",
  "clientId": "...",
  "principalAmount": 56000,
  "annualInterestRate": 8,
  "paymentFrequency": "MONTHLY",
  "termCount": 12,
  "createdById": "..."
}'

# Crear un préstamo diario de prueba
curl -X POST /api/loans -d '{
  "loanStructure": "FLAT_RATE",
  "clientId": "...",
  "principalAmount": 10000,
  "totalFinanceCharge": 3500,
  "paymentFrequency": "DAILY",
  "termCount": 45,
  "createdById": "..."
}'
```

---

## Impacto en PDFs

Los servicios de PDF deben leer `loan.loanStructure` y adaptar:
- Contrato: Cláusulas 2 y 3 usan `getLoanStructureTexts(loanStructure)`
- Plan de pagos: columnas Capital/Interés vs cuota plana
- Estado de cuenta: "Cargo Financiero" vs "Interés"
- Recibo: "Cuota X de 45 (Diaria)" vs "Cuota X de 12 (Mensual)"

Usa las funciones `getFrequencyTexts()` y `getLoanStructureTexts()` del `flatRateCalculator.ts`.
