import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth-middleware";
import { createPayment, getPayments } from "@/lib/services";
import { PaymentType } from "@prisma/client";

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get("page") ?? 1);
  const limit = Number(searchParams.get("limit") ?? 20);
  const loanId = searchParams.get("loanId") ?? undefined;
  const type = searchParams.get("type") as PaymentType | undefined;
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const result = await getPayments(
    {
      loanId,
      type,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
    },
    { page, limit }
  );

  return NextResponse.json(result);
});

export const POST = withAuth(async (req) => {
  const data = await req.json();

  if (!data.loanId) {
    return NextResponse.json(
      { error: { code: "MISSING_LOAN_ID", message: "loanId es requerido" } },
      { status: 400 }
    );
  }

  if (!data.totalAmount || data.totalAmount <= 0) {
    return NextResponse.json(
      { error: { code: "INVALID_AMOUNT", message: "Monto inválido" } },
      { status: 400 }
    );
  }

  if (!data.createdById) {
    return NextResponse.json(
      { error: { code: "MISSING_USER_ID", message: "createdById es requerido" } },
      { status: 400 }
    );
  }

  const result = await createPayment({
    loanId: data.loanId,
    totalAmount: Number(data.totalAmount),
    type: data.type ?? "REGULAR",
    createdById: data.createdById,
    paymentDate: data.paymentDate ? new Date(data.paymentDate) : undefined,
  });

  return NextResponse.json(result, { status: 201 });
});
