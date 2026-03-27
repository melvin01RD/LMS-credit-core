# Informe de Vibe Testing — LMS Credit Core
**Fecha:** 2026-03-26
**Tester:** Claude Sonnet 4.6 (QA Senior automatizado)
**App:** http://localhost:3000
**Sesión:** Exploración completa de todos los flujos principales y edge cases

---

## Resumen Ejecutivo

| Severidad | Cantidad |
|-----------|---------|
| 🔴 Crítico | 2 |
| 🟠 Alto    | 3 |
| 🟡 Medio   | 3 |
| 🔵 Bajo    | 4 |
| **Total**  | **12** |

---

## BUG-001 — Tabla de Amortización muestra todos los valores en RD$ 0.00

| Campo | Valor |
|-------|-------|
| **Severidad** | 🔴 Crítico |
| **Tipo** | Bug funcional |
| **Área** | Detalle de Préstamo → pestaña "Amortización" |
| **Screenshot** | `screenshots/19-amortizacion-zeros-bug.png` |

**Descripción:**
La pestaña "Amortización" en el detalle de cualquier préstamo muestra todas las columnas (Cuota total, Capital, Interés, Balance) con valor `RD$ 0.00` para todas las 10 cuotas. El préstamo SÍ tiene datos válidos (cuota fija RD$ 3,500, cargo financiero RD$ 15,000, 10 cuotas).

**Pasos de reproducción:**
1. Iniciar sesión como Admin
2. Ir a `Dashboard → Préstamos`
3. Click en el préstamo de Darwin Enmanuel Corporan (RD$ 20,000)
4. Click en pestaña **"Amortización"**
5. **Resultado actual:** Todas las filas muestran `RD$ 0.00` en Cuota total, Capital, Interés y Balance
6. **Resultado esperado:** Tabla con el calendario de pagos: fecha, cuota RD$ 3,500, desglose capital/interés progresivo y balance pendiente

---

## BUG-002 — Agenda de Cobros vacía pese a préstamos semanales activos

| Campo | Valor |
|-------|-------|
| **Severidad** | 🔴 Crítico |
| **Tipo** | Bug funcional — lógica de negocio |
| **Área** | Agenda de Cobros |
| **Screenshot** | `screenshots/22-agenda.png` |

**Descripción:**
La sección "Agenda de Cobros" muestra "No hay clientes con cobros programados" para **todos** los días de la semana (Lunes a Sábado). Sin embargo existen 3 préstamos activos con frecuencia **Semanal** que deberían generar cobros en días concretos. El header siempre muestra "0 clientes · RD$ 0.00 en cuotas".

**Pasos de reproducción:**
1. Iniciar sesión como Admin
2. Ir a `Dashboard → Agenda`
3. Click en cada día: Lunes, Martes, Miércoles, Jueves, Viernes, Sábado
4. **Resultado actual:** "No hay clientes con cobros programados para el [día]" en todos
5. **Resultado esperado:** Los 3 préstamos semanales deben aparecer asignados a su día de cobro correspondiente

---

## BUG-003 — Préstamos con cuotas vencidas no cambian estado a "En Mora"

| Campo | Valor |
|-------|-------|
| **Severidad** | 🟠 Alto |
| **Tipo** | Bug de lógica de negocio |
| **Área** | Préstamos / Dashboard |
| **Screenshot** | `screenshots/17-loans-mora-bug.png` |

**Descripción:**
El dashboard muestra en la sección "Próximos Vencimientos":
- Valentina ROSARIO PEÑA → **31 días vencido**
- Daniel Arredondo → **5 días vencido**

Sin embargo, al ir a Préstamos y filtrar por **"En mora"**, el resultado es **0 préstamos**. Ambos préstamos siguen con estado "Activo". El reporte Cartera Vigente PDF también confirma "Activos / En Mora: 3 / 0".

**Pasos de reproducción:**
1. Ir a `Dashboard` → Verificar sección "Próximos Vencimientos": 2 clientes vencidos
2. Ir a `Dashboard → Préstamos`
3. Click en filtro **"En mora"**
4. **Resultado actual:** "0 préstamos registrados" — tabla vacía
5. **Resultado esperado:** Los préstamos con cuotas vencidas >0 días deben aparecer aquí (o actualizarse automáticamente su estado)

---

## BUG-004 — Inconsistencia métrica en barra de progreso del préstamo

| Campo | Valor |
|-------|-------|
| **Severidad** | 🟠 Alto |
| **Tipo** | Bug UX / datos inconsistentes |
| **Área** | Detalle de Préstamo → barra de progreso |
| **Screenshot** | `screenshots/18-loan-detail.png` |

**Descripción:**
En el detalle del préstamo (Darwin, RD$ 20,000):
- La barra de progreso muestra **"RD$ 4,000.00 pagado"** (capital pagado) al lado izquierdo
- El porcentaje **20.0%** se calcula sobre el total pagado vs total a pagar (7,000 / 35,000 = 20%)
- Las tarjetas KPI muestran **"Total pagado: RD$ 7,000.00"**

La etiqueta de la barra usa capital pagado (RD$ 4,000) pero el porcentaje corresponde al total pagado (RD$ 7,000). Son métricas distintas presentadas como si fueran la misma.

**Pasos de reproducción:**
1. Ir a `Préstamos` → Click en préstamo de Darwin (RD$ 20,000)
2. Observar barra de progreso: dice "RD$ 4,000.00 pagado" (20.0%)
3. Observar KPI "Total pagado": RD$ 7,000.00
4. **Resultado actual:** 4,000 ÷ 35,000 = 11.4% ≠ 20.0% mostrado; o bien 7,000 ÷ 35,000 = 20% pero la etiqueta dice 4,000
5. **Resultado esperado:** Etiqueta y porcentaje deben usar la misma métrica (recomendado: mostrar "RD$ 7,000 pagado de RD$ 35,000 (20%)")

---

## BUG-005 — Capital Recuperado incorrecto en PDF Cartera Vigente

| Campo | Valor |
|-------|-------|
| **Severidad** | 🟠 Alto |
| **Tipo** | Bug de datos / cálculo |
| **Área** | Reportes → Cartera Vigente PDF |
| **Screenshot** | `screenshots/24-cartera-vigente-pdf.png` |

**Descripción:**
El PDF de Cartera Vigente muestra **"Capital Recuperado: RD$ 5,200.00"** pero la suma real de pagos de capital registrados es:
- Darwin Enmanuel Corporan: 2 pagos × RD$ 2,000 capital = **RD$ 4,000**
- Valentina ROSARIO PEÑA: 1 pago RD$ 5,200 capital = **RD$ 5,200**
- **Total real: RD$ 9,200**

El reporte subestima el capital recuperado en RD$ 4,000.

**Pasos de reproducción:**
1. Ir a `Reportes`
2. Click en **"Descargar PDF"** de Cartera Vigente
3. Verificar campo "Capital Recuperado"
4. **Resultado actual:** RD$ 5,200.00
5. **Resultado esperado:** RD$ 9,200.00

---

## BUG-006 — Pago tipo "Abono Capital" registrado con Capital=RD$ 0.00

| Campo | Valor |
|-------|-------|
| **Severidad** | 🟡 Medio |
| **Tipo** | Bug de datos / integridad |
| **Área** | Pagos |
| **Screenshot** | `screenshots/20-payments.png` |

**Descripción:**
En la lista de pagos existe un registro de Valentina ROSARIO PEÑA con:
- Tipo: **Abono Capital**
- Monto: RD$ 5,200.00
- Capital: **RD$ 0.00**
- Interés: RD$ 5,200.00

Por definición, un "Abono Capital" debería registrar el monto en la columna Capital. Tener Capital=0 en un Abono Capital es una contradicción.

**Pasos de reproducción:**
1. Ir a `Pagos`
2. Buscar el pago de Valentina del **5/2/2026** con tipo "Abono Capital"
3. **Resultado actual:** Capital: RD$ 0.00, Interés: RD$ 5,200.00
4. **Resultado esperado:** Capital: RD$ 5,200.00, Interés: RD$ 0.00 (o distribución correcta)

---

## BUG-007 — Etiqueta "Capital Pendiente" en dashboard incluye intereses

| Campo | Valor |
|-------|-------|
| **Severidad** | 🟡 Medio |
| **Tipo** | Bug UX / etiquetado engañoso |
| **Área** | Dashboard → KPI Cards |
| **Screenshot** | `screenshots/06-dashboard.png` |

**Descripción:**
El dashboard muestra "Capital Pendiente: RD$ 197.0K" con subtítulo **"103.7% del total"**. El valor RD$ 197,000 es la suma de los saldos pendientes totales (capital + intereses) de todos los préstamos, no el capital puro. El subtítulo "103.7% del total" (que excede 100%) genera confusión al usuario.

**Pasos de reproducción:**
1. Ir al Dashboard
2. Observar KPI "Capital Pendiente": RD$ 197.0K / "103.7% del total"
3. **Resultado actual:** Etiqueta dice "Capital" pero incluye intereses. 103.7% implica que se debe más de lo prestado
4. **Resultado esperado:** Renombrar a "Saldo Pendiente" o "Total por Cobrar". Subtítulo podría ser "X% del capital prestado" o eliminarse si genera confusión

---

## BUG-008 — Búsqueda activa oculta cliente recién creado

| Campo | Valor |
|-------|-------|
| **Severidad** | 🟡 Medio |
| **Tipo** | Bug UX |
| **Área** | Clientes → Crear Cliente |
| **Screenshot** | `screenshots/13-cliente-creado.png` |

**Descripción:**
Si el usuario tiene un término en el buscador de clientes y luego crea un nuevo cliente, al cerrar el formulario el cliente no aparece en la lista porque el filtro sigue activo. El toast "Cliente creado exitosamente" aparece, pero la lista muestra "0 clientes registrados" si el filtro no coincide con el nuevo cliente.

**Pasos de reproducción:**
1. Ir a `Clientes`
2. Escribir algo en el buscador (ej. "!@#$")
3. Click en "Nuevo Cliente"
4. Crear un cliente válido y click "Crear Cliente"
5. **Resultado actual:** Toast de éxito aparece pero la tabla sigue mostrando "0 clientes registrados" con el filtro activo
6. **Resultado esperado:** Limpiar el buscador automáticamente al crear cliente exitosamente, o asegurar que el nuevo cliente sea visible

---

## BUG-009 — Sin validación frontend en Documento de identidad y Teléfono

| Campo | Valor |
|-------|-------|
| **Severidad** | 🔵 Bajo |
| **Tipo** | Bug de validación |
| **Área** | Clientes → Nuevo Cliente |
| **Screenshot** | `screenshots/12-nuevo-cliente-invalid-data.png` |

**Descripción:**
El formulario "Nuevo Cliente" no valida:
- **Documento de identidad**: acepta valores no numéricos como "ABC-INVALID" (debería ser 11 dígitos numéricos para cédula RD)
- **Teléfono**: acepta "123" sin validar la longitud mínima de 10 dígitos

Solo el campo Email tiene validación nativa del browser (tipo="email").

**Pasos de reproducción:**
1. Ir a `Clientes` → "Nuevo Cliente"
2. Rellenar Nombre con cualquier texto
3. En Documento poner "ABC-INVALID", en Teléfono poner "123", en Email poner "test@test.com"
4. Click "Crear Cliente"
5. **Resultado actual:** El formulario se envía sin mostrar error de validación en Documento y Teléfono
6. **Resultado esperado:** Mensaje de error indicando formato inválido antes de enviar al servidor

---

## BUG-010 — RNC en recibos muestra "0-00-00000-0" en lugar de N/A

| Campo | Valor |
|-------|-------|
| **Severidad** | 🔵 Bajo |
| **Tipo** | Bug UX / configuración |
| **Área** | Pagos → Recibo de Pago / Reportes |
| **Screenshot** | `screenshots/21-recibo-pago.png` |

**Descripción:**
Cuando el campo RNC en Configuración está vacío, los recibos PDF y reportes muestran "RNC: 0-00-00000-0" (valor cero por defecto). Debería mostrar "N/A", "No especificado" o estar en blanco.

**Pasos de reproducción:**
1. Verificar que Configuración → Datos del Negocio → RNC esté vacío
2. Ir a `Pagos` → Click en "Ver Recibo de Pago" de cualquier pago
3. **Resultado actual:** Recibo muestra "RNC: 0-00-00000-0"
4. **Resultado esperado:** "RNC: N/A" o campo no mostrado cuando está vacío

---

## BUG-011 — Inconsistencia de color: sección Productos usa esquema morado

| Campo | Valor |
|-------|-------|
| **Severidad** | 🔵 Bajo |
| **Tipo** | Bug UI / design system |
| **Área** | Productos Crediticios |
| **Screenshot** | `screenshots/26-productos.png` |

**Descripción:**
El botón "Nuevo Producto" y los elementos interactivos de la sección "Productos Crediticios" usan colores morados/violeta, mientras que el resto de la aplicación usa un esquema azul. Genera inconsistencia visual.

---

## BUG-012 — Tabla de Préstamos trunca valores en mobile (375px)

| Campo | Valor |
|-------|-------|
| **Severidad** | 🔵 Bajo |
| **Tipo** | Bug responsive |
| **Área** | Préstamos → tabla en mobile |
| **Screenshot** | `screenshots/30-mobile-loans.png` |

**Descripción:**
En viewport de 375px (mobile), la tabla de préstamos:
- Trunca valores monetarios: muestra "RD$ 20,0" en lugar de "RD$ 20,000.00"
- El botón de filtro "Cancelados" queda fuera del viewport sin scroll horizontal visible
- Columnas de Tipo/Tasa, Frecuencia, Pendiente, Estado y Fecha quedan cortadas

**Pasos de reproducción:**
1. Abrir la app en viewport 375px o dispositivo móvil
2. Ir a `Préstamos`
3. **Resultado actual:** Tabla con overflow horizontal, valores numéricos cortados
4. **Resultado esperado:** Tabla responsive con scroll horizontal explícito o diseño de tarjetas en mobile

---

## Hallazgos adicionales (no-bugs)

| # | Área | Observación |
|---|------|------------|
| A1 | Login | Validación de email y campos requeridos usa validación nativa HTML5 — funciona pero los mensajes están en inglés del browser |
| A2 | Login | XSS en campo email bloqueado correctamente por validación `type="email"` del browser |
| A3 | Clientes | Búsqueda en tiempo real funciona correctamente incluyendo estado vacío |
| A4 | Recibos | Generación de PDF funciona correctamente — diseño profesional |
| A5 | Reportes | Cartera Vigente PDF y Excel descargables, bien formateados |
| A6 | Nav | Breadcrumbs presentes en vistas de detalle |
| A7 | Auth | Rutas protegidas redirigen a login sin sesión activa |
| A8 | Pagos | Campo "Registrado por" presente en todos los pagos — buen audit trail |

---

*Generado automáticamente — Sesión de Vibe Testing con Playwright MCP*
