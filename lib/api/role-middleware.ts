import { NextResponse } from "next/server";
import { getSession, SessionPayload } from "../auth";
import { ServiceError } from "../errors";
import { ZodError } from "zod";
import { UserRole } from "@prisma/client";

// Re-exportar para que los imports de role-middleware tengan acceso
export interface AuthenticatedRequest extends Request {
  session: SessionPayload;
}

/**
 * Wrapper de autenticación + autorización por rol.
 * Verifica sesión válida → 401 si no hay sesión.
 * Verifica que session.role esté en allowedRoles → 403 si no tiene permiso.
 * Mismo manejo de errores que withAuth.
 *
 * Uso:
 *   export const GET = withRole([UserRole.ADMIN], async (req) => { ... });
 *   export const GET = withRole(['ADMIN'], async (req) => { ... });
 */
export function withRole(
  allowedRoles: UserRole[],
  handler: (
    req: AuthenticatedRequest,
    context?: { params: Promise<Record<string, string>> }
  ) => Promise<NextResponse>
) {
  return async (
    req: Request,
    context?: { params: Promise<Record<string, string>> }
  ): Promise<NextResponse> => {
    try {
      const session = await getSession();

      if (!session) {
        return NextResponse.json(
          {
            error: {
              code: "NOT_AUTHENTICATED",
              message: "Debe iniciar sesión para acceder a este recurso",
            },
          },
          { status: 401 }
        );
      }

      if (!allowedRoles.includes(session.role as UserRole)) {
        return NextResponse.json(
          {
            error: {
              code: "FORBIDDEN",
              message: "No tiene permisos para realizar esta acción",
            },
          },
          { status: 403 }
        );
      }

      (req as AuthenticatedRequest).session = session;
      return await handler(req as AuthenticatedRequest, context);
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Error de validación",
              details: error.errors.map((e) => ({
                field: e.path.join("."),
                message: e.message,
              })),
            },
          },
          { status: 400 }
        );
      }

      if (error instanceof ServiceError) {
        return NextResponse.json(
          { error: { code: error.code, message: error.message } },
          { status: error.statusCode }
        );
      }

      console.error("Unhandled error:", error);
      return NextResponse.json(
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "Error interno del servidor",
          },
        },
        { status: 500 }
      );
    }
  };
}
