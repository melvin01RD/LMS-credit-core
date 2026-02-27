import { NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api/error-handler";
import { getSession } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export const GET = withErrorHandler(async () => {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      {
        error: {
          code: "NOT_AUTHENTICATED",
          message: "No hay sesión activa",
        },
      },
      { status: 401 }
    );
  }

  return NextResponse.json({ user: session });
});
