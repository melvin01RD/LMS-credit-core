import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, SESSION_JWT_EXPIRY } from "../config/session";

// ============================================
// CONSTANTS
// ============================================

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET no está definido en las variables de entorno");
  return secret;
}

// ============================================
// INTERFACES
// ============================================

export interface SessionPayload {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "ADMIN" | "OPERATOR";
  lastActivity?: number; // Unix seconds; present in tokens issued after session-timeout deploy
}

// ============================================
// SESSION OPERATIONS
// ============================================

/**
 * Crea un JWT con lastActivity y lo guarda en una session cookie (sin maxAge).
 * La cookie muere al cerrar el navegador.
 */
export async function createSession(payload: SessionPayload): Promise<void> {
  const JWT_SECRET = getJwtSecret();
  const now = Math.floor(Date.now() / 1000);
  const token = jwt.sign(
    { ...payload, lastActivity: now },
    JWT_SECRET,
    { expiresIn: SESSION_JWT_EXPIRY }
  );

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // Sin maxAge — session cookie, muere al cerrar el navegador
  });
}

/**
 * Lee la cookie, verifica el JWT y retorna el payload.
 * Expone lastActivity; usa iat como fallback para tokens legacy (pre-deploy).
 */
export async function getSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token) return null;

    const JWT_SECRET = getJwtSecret();
    const decoded = jwt.verify(token, JWT_SECRET) as SessionPayload & {
      iat: number;
      exp: number;
    };

    return {
      userId: decoded.userId,
      email: decoded.email,
      firstName: decoded.firstName,
      lastName: decoded.lastName,
      role: decoded.role,
      lastActivity: decoded.lastActivity ?? decoded.iat,
    };
  } catch {
    return null;
  }
}

/**
 * Re-firma el JWT con lastActivity actualizado para sliding expiration.
 * Retorna el nuevo token string; el caller lo setea en la cookie de la response.
 */
export function refreshSession(payload: SessionPayload): string {
  const JWT_SECRET = getJwtSecret();
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      userId: payload.userId,
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      role: payload.role,
      lastActivity: now,
    },
    JWT_SECRET,
    { expiresIn: SESSION_JWT_EXPIRY }
  );
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
