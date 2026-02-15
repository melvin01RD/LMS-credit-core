import { describe, it, expect, vi, beforeEach } from "vitest";
import "./setup";
import {
  getUserById,
  getUserByEmail,
  getUsers,
  updateUser,
  isEmailRegistered,
  getUserStats,
} from "../../../lib/services/user.service";
import { UserNotFoundError, DuplicateEmailError } from "../../../lib/errors";
import { UserRole } from "@prisma/client";
import { prismaMock } from "./prisma.mock";

// ============================================
// Helper: mock user data
// ============================================
const createMockUser = (overrides = {}) => ({
  id: "user-1",
  email: "admin@test.com",
  password: "$2a$10$hashedpassword",
  firstName: "Admin",
  lastName: "User",
  role: UserRole.ADMIN,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("getUserById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return user without password", async () => {
    prismaMock.user.findUnique.mockResolvedValue(createMockUser());

    const result = await getUserById("user-1");

    expect(result.id).toBe("user-1");
    expect(result).not.toHaveProperty("password");
  });

  it("should throw UserNotFoundError when not found", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(getUserById("non-existent")).rejects.toThrow(UserNotFoundError);
  });
});

describe("getUserByEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return user by email", async () => {
    prismaMock.user.findUnique.mockResolvedValue(createMockUser());

    const result = await getUserByEmail("admin@test.com");

    expect(result.email).toBe("admin@test.com");
  });

  it("should throw UserNotFoundError when email not found", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(getUserByEmail("nobody@test.com")).rejects.toThrow(UserNotFoundError);
  });
});

describe("getUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return all users without filters", async () => {
    const mockUsers = [
      { ...createMockUser(), _count: { createdLoans: 5, payments: 10 } },
      { ...createMockUser({ id: "user-2" }), _count: { createdLoans: 3, payments: 7 } },
    ];
    prismaMock.user.findMany.mockResolvedValue(mockUsers);

    const result = await getUsers();

    expect(result).toHaveLength(2);
  });

  it("should filter by role", async () => {
    prismaMock.user.findMany.mockResolvedValue([]);

    await getUsers({ role: UserRole.OPERATOR });

    const callArgs = prismaMock.user.findMany.mock.calls[0][0];
    expect(callArgs.where.role).toBe(UserRole.OPERATOR);
  });

  it("should filter by active status", async () => {
    prismaMock.user.findMany.mockResolvedValue([]);

    await getUsers({ active: true });

    const callArgs = prismaMock.user.findMany.mock.calls[0][0];
    expect(callArgs.where.active).toBe(true);
  });

  it("should filter by search term", async () => {
    prismaMock.user.findMany.mockResolvedValue([]);

    await getUsers({ search: "Admin" });

    const callArgs = prismaMock.user.findMany.mock.calls[0][0];
    expect(callArgs.where.OR).toBeDefined();
    expect(callArgs.where.OR).toHaveLength(3); // firstName, lastName, email
  });
});

describe("updateUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update user fields", async () => {
    const existingUser = createMockUser();
    const updatedUser = createMockUser({ firstName: "Carlos" });

    prismaMock.user.findUnique.mockResolvedValue(existingUser);
    prismaMock.user.update.mockResolvedValue(updatedUser);

    const result = await updateUser("user-1", { firstName: "Carlos" });

    expect(result.firstName).toBe("Carlos");
    expect(result).not.toHaveProperty("password");
  });

  it("should check for duplicate email when changing email", async () => {
    const existingUser = createMockUser();
    prismaMock.user.findUnique
      .mockResolvedValueOnce(existingUser) // first call: find existing user
      .mockResolvedValueOnce(null); // second call: check email uniqueness
    prismaMock.user.update.mockResolvedValue(createMockUser({ email: "new@test.com" }));

    await updateUser("user-1", { email: "new@test.com" });

    expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(2);
  });

  it("should throw DuplicateEmailError when new email already exists", async () => {
    const existingUser = createMockUser();
    const otherUser = createMockUser({ id: "user-2", email: "taken@test.com" });

    prismaMock.user.findUnique
      .mockResolvedValueOnce(existingUser)
      .mockResolvedValueOnce(otherUser); // email already taken

    await expect(
      updateUser("user-1", { email: "taken@test.com" })
    ).rejects.toThrow(DuplicateEmailError);
  });

  it("should throw UserNotFoundError when user does not exist", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(
      updateUser("non-existent", { firstName: "Carlos" })
    ).rejects.toThrow(UserNotFoundError);
  });
});

describe("getUserStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return user activity stats", async () => {
    prismaMock.user.findUnique.mockResolvedValue(createMockUser());
    prismaMock.loan.count.mockResolvedValue(15);
    prismaMock.payment.count.mockResolvedValue(42);
    prismaMock.loan.aggregate.mockResolvedValue({
      _sum: { principalAmount: 500000 },
    });

    const result = await getUserStats("user-1");

    expect(result.userId).toBe("user-1");
    expect(result.loansCreated).toBe(15);
    expect(result.paymentsProcessed).toBe(42);
    expect(result.totalLoanAmount).toBe(500000);
  });

  it("should handle user with no activity", async () => {
    prismaMock.user.findUnique.mockResolvedValue(createMockUser());
    prismaMock.loan.count.mockResolvedValue(0);
    prismaMock.payment.count.mockResolvedValue(0);
    prismaMock.loan.aggregate.mockResolvedValue({
      _sum: { principalAmount: null },
    });

    const result = await getUserStats("user-1");

    expect(result.loansCreated).toBe(0);
    expect(result.paymentsProcessed).toBe(0);
    expect(result.totalLoanAmount).toBe(0);
  });

  it("should throw UserNotFoundError when user does not exist", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(getUserStats("non-existent")).rejects.toThrow(UserNotFoundError);
  });
});

describe("isEmailRegistered", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return true when email exists", async () => {
    prismaMock.user.count.mockResolvedValue(1);

    const result = await isEmailRegistered("admin@test.com");

    expect(result).toBe(true);
  });

  it("should return false when email does not exist", async () => {
    prismaMock.user.count.mockResolvedValue(0);

    const result = await isEmailRegistered("nobody@test.com");

    expect(result).toBe(false);
  });

  it("should exclude specific user when checking", async () => {
    prismaMock.user.count.mockResolvedValue(0);

    await isEmailRegistered("admin@test.com", "user-1");

    const callArgs = prismaMock.user.count.mock.calls[0][0];
    expect(callArgs.where.id).toEqual({ not: "user-1" });
  });
});
