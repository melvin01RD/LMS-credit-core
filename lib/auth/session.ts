import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

// ============================================
// CONSTANTS
// ============================================

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET no está definido en las variables de entorno");
  return secret;
}

const SESSION_COOKIE_NAME = "lms_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 días

// ============================================
// INTERFACES
// ============================================

export interface SessionPayload {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "ADMIN" | "OPERATOR";
}

// ============================================
// SESSION OPERATIONS
// ============================================

/**
 * Crea un JWT y lo guarda en una cookie httpOnly.
 * Se llama después de autenticar al usuario exitosamente.
 */
export async function createSession(payload: SessionPayload): Promise<void> {
  const JWT_SECRET = getJwtSecret();
  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: SESSION_MAX_AGE,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

/**
 * Lee la cookie de sesión y verifica el JWT.
 * Retorna el payload si es válido, null si no hay sesión o es inválida.
 */
export async function getSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token) return null;

    const JWT_SECRET = getJwtSecret();
    const decoded = jwt.verify(token, JWT_SECRET) as SessionPayload & { iat: number; exp: number };

    return {
      userId: decoded.userId,
      email: decoded.email,
      firstName: decoded.firstName,
      lastName: decoded.lastName,
      role: decoded.role,
    };
  } catch {
    return null;
  }
}

/**
 * Elimina la cookie de sesión (logout).
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
