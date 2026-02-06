import { NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api/error-handler";
import { getLoanById, cancelLoan, markLoanAsOverdue } from "@/lib/services";

export const GET = withErrorHandler(async (req, context) => {
  const params = await context!.params;
  const loan = await getLoanById(params.id);
  return NextResponse.json(loan);
});

export const PATCH = withErrorHandler(async (req, context) => {
  const params = await context!.params;
  const { action, userId } = await req.json();

  if (!userId) {
    return NextResponse.json(
      { error: { code: "MISSING_USER_ID", message: "userId es requerido" } },
      { status: 400 }
    );
  }

  let result;
  switch (action) {
    case "cancel":
      result = await cancelLoan(params.id, userId);
      break;
    case "mark_overdue":
      result = await markLoanAsOverdue(params.id, userId);
      break;
    default:
      return NextResponse.json(
        { error: { code: "INVALID_ACTION", message: "Acción no válida. Use 'cancel' o 'mark_overdue'" } },
        { status: 400 }
      );
  }

  return NextResponse.json(result);
});
