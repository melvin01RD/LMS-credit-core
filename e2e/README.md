# E2E Tests — LMS Credit Core

Tests de integración end-to-end con Playwright para LMS Credit Core.

## Estructura

```
e2e/
├── helpers.ts                    # Utilidades compartidas (login, constantes)
├── BUG_REPORT.md                 # Informe completo de bugs detectados
│
├── 01-autenticacion.spec.ts      # Login, logout, guards
├── 02-dashboard.spec.ts          # Dashboard KPIs y gráficas
├── 03-clientes.spec.ts           # CRUD Clientes
├── 04-prestamos.spec.ts          # CRUD Préstamos
├── 05-pagos.spec.ts              # Registro y listado de pagos
├── 06-reportes.spec.ts           # Generación de PDFs y Excel
├── 07-seguridad.spec.ts          # Headers de seguridad, CORS
├── 08-rbac.spec.ts               # Control de acceso por rol
│
├── 09-vibe-regression.spec.ts    # Regresión de bugs detectados en Vibe Testing
├── 10-flujos-principales.spec.ts # Cobertura E2E flujos de negocio completos
│
└── screenshots/                  # Evidencias visuales del Vibe Testing
```

## Requisitos

- Node.js >= 18
- La app corriendo en `http://localhost:3000`
- Base de datos con datos seed activa

## Instalación

```bash
# Instalar dependencias del proyecto (incluye Playwright)
npm install

# Instalar los browsers de Playwright (solo la primera vez)
npx playwright install chromium
```

## Ejecución

### Todos los tests
```bash
npm run test:e2e
```

### Con UI visual (modo debugging)
```bash
npm run test:e2e:ui
```

### En modo headed (ver el browser)
```bash
npm run test:e2e:headed
```

### Solo regresión de bugs (Vibe Testing)
```bash
npx playwright test e2e/09-vibe-regression.spec.ts --headed
```

### Solo flujos principales
```bash
npx playwright test e2e/10-flujos-principales.spec.ts --headed
```

### Tests de autenticación
```bash
npm run test:e2e:auth
```

### Tests de seguridad y RBAC
```bash
npm run test:e2e:seguridad
```

### Ver el reporte HTML después de correr
```bash
npm run test:e2e:report
```

### En CI/CD (sin browser, headless)
```bash
npm run test:e2e:ci
```

## Variables de entorno

Crear `.env.test.local` en la raíz del proyecto:

```env
# Para correr contra localhost (por defecto)
BASE_URL=http://localhost:3000

# Para correr contra producción
# BASE_URL=https://lms-credit-core-production.up.railway.app
```

## Credenciales de prueba

| Rol | Email | Password |
|-----|-------|----------|
| ADMIN | melvin01rd@gmail.com | Admin123 |
| OPERATOR | operador.prueba@lmscredit.com | Operador2024! |

> ⚠️ Cambiar credenciales en `e2e/helpers.ts` si el entorno de prueba usa credenciales distintas.

## Archivos de evidencia

- **`e2e/BUG_REPORT.md`** — Informe completo con 12 bugs encontrados, pasos de reproducción y screenshots
- **`e2e/screenshots/`** — Capturas de pantalla numeradas del Vibe Testing

## Resumen de bugs críticos cubiertos por regresión

| Test | Bug | Descripción |
|------|-----|-------------|
| `09-vibe-regression` BUG-001 | 🔴 Crítico | Tabla Amortización muestra todos RD$ 0.00 |
| `09-vibe-regression` BUG-002 | 🔴 Crítico | Agenda vacía pese a préstamos semanales activos |
| `09-vibe-regression` BUG-003 | 🟠 Alto | Préstamos vencidos no cambian a "En Mora" |
| `09-vibe-regression` BUG-008 | 🟡 Medio | Búsqueda activa oculta cliente recién creado |
| `09-vibe-regression` BUG-009 | 🔵 Bajo | Sin validación de Documento/Teléfono en frontend |
| `09-vibe-regression` BUG-012 | 🔵 Bajo | Tabla truncada en mobile 375px |

## CI/CD Integration

Estos tests están listos para integrarse en GitHub Actions:

```yaml
- name: Run E2E Tests
  run: |
    npm ci
    npx playwright install --with-deps chromium
    BASE_URL=http://localhost:3000 npm run test:e2e:ci
```

El reporte se genera en `playwright-report/` y los resultados en `test-results/results.json`.
