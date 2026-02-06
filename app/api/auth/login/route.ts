import { NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api/error-handler";
import { authenticateUser } from "@/lib/services";
import { createSession } from "@/lib/auth";
import { loginSchema } from "@/lib/validations";

export const POST = withErrorHandler(async (req) => {
  const body = await req.json();
  const { email, password } = loginSchema.parse(body);

  const { user } = await authenticateUser(email, password);

  await createSession({
    userId: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
  });

  return NextResponse.json({
    user,
    message: "Sesión iniciada exitosamente",
  });
});
