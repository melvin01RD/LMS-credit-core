import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { withRole } from "@/lib/api/role-middleware";
import { INACTIVITY_TIMEOUT_SECONDS } from "@/lib/config/session";
import { UserRole } from "@prisma/client";

// ============================================
// MOCKS
// ============================================

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
  refreshSession: vi.fn().mockReturnValue("refreshed-token"),
}));

// ============================================
// HELPERS
// ============================================

const now = Math.floor(Date.now() / 1000);

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    userId: "user-1",
    email: "admin@test.com",
    firstName: "Admin",
    lastName: "User",
    role: "ADMIN" as const,
    ...overrides,
  };
}

function makeRequest() {
  return new Request("http://localhost/api/test");
}

function makeHandler() {
  return vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
}

// ============================================
// TESTS
// ============================================

describe("withRole — inactivity timeout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rechaza JWT con lastActivity > 10 min (SESSION_EXPIRED 401)", async () => {
    const { getSession } = await import("@/lib/auth");
    const expiredLastActivity = now - (INACTIVITY_TIMEOUT_SECONDS + 60); // 11 min ago
    vi.mocked(getSession).mockResolvedValueOnce(
      makeSession({ lastActivity: expiredLastActivity })
    );

    const handler = makeHandler();
    const response = await withRole([UserRole.ADMIN], handler)(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("SESSION_EXPIRED");
    expect(handler).not.toHaveBeenCalled();
  });

  it("acepta JWT con lastActivity reciente (< 10 min)", async () => {
    const { getSession } = await import("@/lib/auth");
    vi.mocked(getSession).mockResolvedValueOnce(
      makeSession({ lastActivity: now - 30 }) // 30 seconds ago
    );

    const handler = makeHandler();
    const response = await withRole([UserRole.ADMIN], handler)(makeRequest());

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("emite JWT renovado con lastActivity actualizado en la response", async () => {
    const { getSession, refreshSession } = await import("@/lib/auth");
    vi.mocked(getSession).mockResolvedValueOnce(
      makeSession({ lastActivity: now - 30 })
    );

    const handler = makeHandler();
    const response = await withRole([UserRole.ADMIN], handler)(makeRequest());

    expect(vi.mocked(refreshSession)).toHaveBeenCalledOnce();
    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain("lms_session=refreshed-token");
  });

  it("rechaza roles incorrectos sin renovar token (regresión comportamiento original)", async () => {
    const { getSession, refreshSession } = await import("@/lib/auth");
    vi.mocked(getSession).mockResolvedValueOnce(
      makeSession({ role: "OPERATOR", lastActivity: now - 30 })
    );

    const handler = makeHandler();
    const response = await withRole([UserRole.ADMIN], handler)(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(handler).not.toHaveBeenCalled();
    expect(vi.mocked(refreshSession)).not.toHaveBeenCalled();
  });
});

describe("withRole — sin sesión", () => {
  it("rechaza request sin cookie (NOT_AUTHENTICATED 401)", async () => {
    const { getSession } = await import("@/lib/auth");
    vi.mocked(getSession).mockResolvedValueOnce(null);

    const handler = makeHandler();
    const response = await withRole([UserRole.ADMIN], handler)(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("NOT_AUTHENTICATED");
    expect(handler).not.toHaveBeenCalled();
  });
});
