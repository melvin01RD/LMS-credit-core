# LMS-credit-core
Aplicación web completa desarrollada con Next.js 16 , PostgreSQL, Prisma y autenticación JWT para la gestión profesional de créditos y clientes.

# 🚀 Características

- ✅ **Autenticación JWT**: Sistema seguro de registro e inicio de sesión  
- ✅ **Gestión de Clientes**: CRUD completo para administrar información de clientes  
- ✅ **Gestión de Créditos**: Crear y administrar créditos con cálculo automático de cuotas  
- ✅ **Dashboard Administrativo**: Panel de control con métricas y estadísticas  
- ✅ **Diseño Profesional**: Interfaz moderna estilo banco con Tailwind CSS  
- ✅ **API RESTful**: Endpoints seguros y bien estructurados  

---

## 🛠️ Stack Tecnológico

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS  
- **Backend**: Next.js API Routes  
- **Base de Datos**: PostgreSQL con Prisma ORM  
- **Autenticación**: JWT (JSON Web Tokens)  
- **Validación**: Zod  
- **Seguridad**: bcryptjs para hash de contraseñas  

---

## 📋 Requisitos Previos

- Node.js 18+  
- PostgreSQL 14+  
- npm o yarn  

---

## 🔧 Instalación

### 1. Instalar dependencias
```bash
npm install
2. Configurar variables de entorno
Copia el archivo .env.example a .env y configura tu base de datos:

bash
Copiar código
cp .env.example .env
Edita el archivo .env:

env
Copiar código
DATABASE_URL="postgresql://usuario:password@localhost:5432/yapresto?schema=public"
JWT_SECRET="tu_secreto_jwt_muy_seguro_cambialo_en_produccion"
NEXTAUTH_URL="http://localhost:3000"
3. Configurar la base de datos
bash
Copiar código
# Generar el cliente de Prisma
npx prisma generate

# Ejecutar las migraciones
npx prisma migrate dev --name init

# (Opcional) Abrir Prisma Studio para ver la base de datos
npx prisma studio
4. Iniciar el servidor de desarrollo
bash
Copiar código
npm run dev
La aplicación estará disponible en:
👉 http://localhost:3000

📁 Estructura del Proyecto
text
Copiar código
yapresto.com/
├── app/
│   ├── api/                            # API Routes
│   │   ├── auth/                       # Autenticación
│   │   ├── clientes/                   # Gestión de clientes
│   │   └── creditos/                   # Gestión de créditos
│   ├── dashboard/                      # Dashboard administrativo
│   ├── login/                          # Página de login
│   ├── register/                       # Página de registro
│   └── page.tsx                        # Home page
├── lib/                                # Utilidades
│   ├── prisma.ts                       # Cliente de Prisma
│   ├── jwt.ts                          # Funciones JWT
│   ├── auth.ts                         # Hash de contraseñas
│   └── middleware.ts                   # Middleware de autenticación
├── prisma/
│   └── schema.prisma                   # Esquema de la base de datos
└── package.json
📊 Modelo de Datos
User
Autenticación y gestión de usuarios

Roles: user, admin

Cliente
Información personal completa

Gestión de datos de contacto

Historial de créditos

Crédito
Monto y plazo del crédito

Cálculo automático de cuotas

Seguimiento del estado (activo, pagado, vencido)

Registro de pagos

Pago
Registro detallado de pagos

Métodos de pago múltiples

Actualización automática del estado del crédito

🔐 API Endpoints
Autenticación
POST /api/auth/register — Registrar nuevo usuario

POST /api/auth/login — Iniciar sesión

Clientes (requieren autenticación)
GET /api/clientes — Listar todos los clientes

POST /api/clientes — Crear nuevo cliente

GET /api/clientes/[id] — Obtener cliente por ID

PUT /api/clientes/[id] — Actualizar cliente

DELETE /api/clientes/[id] — Eliminar cliente

Créditos (requieren autenticación)
GET /api/creditos — Listar todos los créditos

POST /api/creditos — Crear nuevo crédito

GET /api/creditos/[id] — Obtener crédito por ID

DELETE /api/creditos/[id] — Eliminar crédito

POST /api/creditos/[id]/pagos — Registrar un pago

🎨 Características de la UI
Home Page: Landing page profesional estilo banco

Dashboard: Panel de control con métricas en tiempo real

Gestión de Clientes: Tabla con listado completo de clientes

Gestión de Créditos: Visualización de créditos con estado

Formularios: Formularios completos con validación

Responsive: Diseño adaptable a todos los dispositivos

🚀 Scripts Disponibles
bash
Copiar código
npm run dev      # Iniciar en modo desarrollo
npm run build    # Construir para producción
npm run start    # Iniciar en modo producción
npm run lint     # Ejecutar linter
🔒 Seguridad
Contraseñas hasheadas con bcrypt (10 rounds)

Autenticación JWT con expiración de 7 días

Middleware de autenticación en todas las rutas protegidas

Validación de datos con Zod

Variables de entorno para secretos

Copiar código

