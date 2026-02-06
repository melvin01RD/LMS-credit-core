import { NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api/error-handler";
import { createUser, getUsers } from "@/lib/services";
import { UserRole } from "@prisma/client";

export const GET = withErrorHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role") as UserRole | undefined;
  const active = searchParams.get("active");
  const search = searchParams.get("search") ?? undefined;

  const users = await getUsers({
    role,
    active: active !== null ? active === "true" : undefined,
    search,
  });

  return NextResponse.json(users);
});

export const POST = withErrorHandler(async (req) => {
  const data = await req.json();
  const user = await createUser(data);
  return NextResponse.json(user, { status: 201 });
});
