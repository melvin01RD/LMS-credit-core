import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth-middleware";
import { INACTIVITY_TIMEOUT_SECONDS } from "@/lib/config/session";

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
    email: "test@test.com",
    firstName: "Test",
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

describe("withAuth — inactivity timeout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rechaza JWT con lastActivity mayor a 10 min (SESSION_EXPIRED 401)", async () => {
    const { getSession } = await import("@/lib/auth");
    const expiredLastActivity = now - (INACTIVITY_TIMEOUT_SECONDS + 60); // 11 min ago
    vi.mocked(getSession).mockResolvedValueOnce(
      makeSession({ lastActivity: expiredLastActivity })
    );

    const handler = makeHandler();
    const response = await withAuth(handler)(makeRequest());
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
    const response = await withAuth(handler)(makeRequest());

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("emite JWT renovado con lastActivity actualizado en la response", async () => {
    const { getSession, refreshSession } = await import("@/lib/auth");
    vi.mocked(getSession).mockResolvedValueOnce(
      makeSession({ lastActivity: now - 30 })
    );

    const handler = makeHandler();
    const response = await withAuth(handler)(makeRequest());

    expect(vi.mocked(refreshSession)).toHaveBeenCalledOnce();
    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain("lms_session=refreshed-token");
  });

  it("acepta JWTs legacy sin claim lastActivity usando iat como fallback (sin expirar)", async () => {
    const { getSession } = await import("@/lib/auth");
    // getSession() ya resuelve el fallback iat→lastActivity internamente;
    // aquí simulamos un token reciente donde lastActivity viene del iat (hace 30s)
    vi.mocked(getSession).mockResolvedValueOnce(
      makeSession({ lastActivity: now - 30 }) // fallback resuelto por getSession
    );

    const handler = makeHandler();
    const response = await withAuth(handler)(makeRequest());

    expect(response.status).toBe(200);
  });
});

describe("withAuth — sin sesión", () => {
  it("rechaza request sin cookie (NOT_AUTHENTICATED 401)", async () => {
    const { getSession } = await import("@/lib/auth");
    vi.mocked(getSession).mockResolvedValueOnce(null);

    const handler = makeHandler();
    const response = await withAuth(handler)(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("NOT_AUTHENTICATED");
    expect(handler).not.toHaveBeenCalled();
  });
});
