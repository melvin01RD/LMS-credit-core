import { NextResponse } from "next/server";
import { getSession, SessionPayload } from "../auth";
import { ServiceError } from "../errors";
import { ZodError } from "zod";

// ============================================
// INTERFACES
// ============================================

export interface AuthenticatedRequest extends Request {
  session: SessionPayload;
}

// ============================================
// AUTH MIDDLEWARE
// ============================================

/**
 * Wrapper que combina autenticación + manejo de errores.
 * Verifica la cookie de sesión antes de ejecutar el handler.
 * Si no hay sesión válida, retorna 401.
 *
 * Uso:
 *   export const GET = withAuth(async (req) => {
 *     // req.session.userId disponible
 *     return NextResponse.json({ ok: true });
 *   });
 */
export function withAuth(
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
