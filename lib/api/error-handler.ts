import { NextResponse } from "next/server";
import { ServiceError } from "../errors";
import { ZodError } from "zod";

// ============================================
// ERROR HANDLER MIDDLEWARE
// ============================================

/**
 * Wrapper para API routes que captura ServiceError y mapea a HTTP responses.
 * 
 * Uso:
 *   export const POST = withErrorHandler(async (req) => {
 *     const data = await req.json();
 *     const result = await createClient(data);
 *     return NextResponse.json(result, { status: 201 });
 *   });
 */
export function withErrorHandler(
  handler: (req: Request, context?: { params: Promise<Record<string, string>> }) => Promise<NextResponse>
) {
  return async (
    req: Request,
    context?: { params: Promise<Record<string, string>> }
  ): Promise<NextResponse> => {
    try {
      return await handler(req, context);
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
          {
            error: {
              code: error.code,
              message: error.message,
            },
          },
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
