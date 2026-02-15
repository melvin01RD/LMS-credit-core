import { describe, it, expect, vi, beforeEach } from "vitest";
import "./setup";
import { createUser, authenticateUser } from "../../../lib/services/user.service";
import {
  DuplicateEmailError,
  InvalidCredentialsError,
  InvalidPasswordError,
  UserInactiveError,
} from "../../../lib/errors";
import { UserRole } from "@prisma/client";
import { prismaMock } from "./prisma.mock";

// ============================================
// Helper: mock user data
// ============================================
const createMockUser = (overrides = {}) => ({
  id: "user-1",
  email: "admin@test.com",
  password: "$2a$10$hashedpassword", // bcrypt hash placeholder
  firstName: "Admin",
  lastName: "User",
  role: UserRole.ADMIN,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Mock bcrypt
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("$2a$10$mockedhash"),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

describe("createUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a user with valid data", async () => {
    const mockUser = createMockUser();
    prismaMock.user.findUnique.mockResolvedValue(null); // no duplicate
    prismaMock.user.create.mockResolvedValue(mockUser);

    const result = await createUser({
      email: "admin@test.com",
      password: "SecurePass1",
      firstName: "Admin",
      lastName: "User",
    });

    expect(result.id).toBe("user-1");
    expect(result).not.toHaveProperty("password"); // should be sanitized
    expect(prismaMock.user.create).toHaveBeenCalledOnce();
  });

  it("should default role to OPERATOR", async () => {
    const mockUser = createMockUser({ role: UserRole.OPERATOR });
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue(mockUser);

    await createUser({
      email: "operator@test.com",
      password: "SecurePass1",
      firstName: "Juan",
      lastName: "Pérez",
    });

    const callArgs = prismaMock.user.create.mock.calls[0][0];
    expect(callArgs.data.role).toBe(UserRole.OPERATOR);
  });

  it("should lowercase and trim email", async () => {
    const mockUser = createMockUser();
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue(mockUser);

    await createUser({
      email: "ADMIN@Test.COM",
      password: "SecurePass1",
      firstName: "Admin",
      lastName: "User",
    });

    const callArgs = prismaMock.user.create.mock.calls[0][0];
    expect(callArgs.data.email).toBe("admin@test.com");
  });

  it("should throw DuplicateEmailError when email exists", async () => {
    prismaMock.user.findUnique.mockResolvedValue(createMockUser());

    await expect(
      createUser({
        email: "admin@test.com",
        password: "SecurePass1",
        firstName: "Admin",
        lastName: "User",
      })
    ).rejects.toThrow(DuplicateEmailError);
  });

  it("should throw InvalidPasswordError for short password", async () => {
    await expect(
      createUser({
        email: "admin@test.com",
        password: "Short1",
        firstName: "Admin",
        lastName: "User",
      })
    ).rejects.toThrow(InvalidPasswordError);
  });

  it("should throw InvalidPasswordError for password without uppercase", async () => {
    await expect(
      createUser({
        email: "admin@test.com",
        password: "securepass1",
        firstName: "Admin",
        lastName: "User",
      })
    ).rejects.toThrow(InvalidPasswordError);
  });

  it("should throw InvalidPasswordError for password without number", async () => {
    await expect(
      createUser({
        email: "admin@test.com",
        password: "SecurePass",
        firstName: "Admin",
        lastName: "User",
      })
    ).rejects.toThrow(InvalidPasswordError);
  });

  it("should throw InvalidCredentialsError for invalid email format", async () => {
    await expect(
      createUser({
        email: "not-valid",
        password: "SecurePass1",
        firstName: "Admin",
        lastName: "User",
      })
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it("should throw error for short firstName", async () => {
    await expect(
      createUser({
        email: "admin@test.com",
        password: "SecurePass1",
        firstName: "A",
        lastName: "User",
      })
    ).rejects.toThrow();
  });
});

describe("authenticateUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should authenticate with valid credentials", async () => {
    const mockUser = createMockUser();
    prismaMock.user.findUnique.mockResolvedValue(mockUser);

    const { default: bcrypt } = await import("bcryptjs");
    (bcrypt.compare as any).mockResolvedValue(true);

    const result = await authenticateUser("admin@test.com", "SecurePass1");

    expect(result.user.id).toBe("user-1");
    expect(result.user.email).toBe("admin@test.com");
    expect(result.user.role).toBe(UserRole.ADMIN);
  });

  it("should throw InvalidCredentialsError for non-existent user", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(
      authenticateUser("nobody@test.com", "SecurePass1")
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it("should throw InvalidCredentialsError for wrong password", async () => {
    const mockUser = createMockUser();
    prismaMock.user.findUnique.mockResolvedValue(mockUser);

    const { default: bcrypt } = await import("bcryptjs");
    (bcrypt.compare as any).mockResolvedValue(false);

    await expect(
      authenticateUser("admin@test.com", "WrongPassword1")
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it("should throw UserInactiveError for deactivated user", async () => {
    const inactiveUser = createMockUser({ active: false });
    prismaMock.user.findUnique.mockResolvedValue(inactiveUser);

    await expect(
      authenticateUser("admin@test.com", "SecurePass1")
    ).rejects.toThrow(UserInactiveError);
  });
});
