import { describe, it, expect, vi, beforeEach } from "vitest";
import "./setup";
import {
  deactivateUser,
  reactivateUser,
  changePassword,
  resetPassword,
  updateUserRole,
} from "../../../lib/services/user.service";
import {
  UserNotFoundError,
  CannotDeactivateSelfError,
  InvalidCredentialsError,
  InvalidPasswordError,
} from "../../../lib/errors";
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

// Mock bcrypt
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("$2a$10$mockedhash"),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

// ============================================
// deactivateUser
// ============================================

describe("deactivateUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should deactivate another user", async () => {
    const targetUser = createMockUser({ id: "user-2" });
    const deactivatedUser = createMockUser({ id: "user-2", active: false });

    prismaMock.user.findUnique.mockResolvedValue(targetUser);
    prismaMock.user.update.mockResolvedValue(deactivatedUser);

    const result = await deactivateUser("user-2", "user-1");

    expect(result.active).toBe(false);
    expect(result).not.toHaveProperty("password");
  });

  it("should throw CannotDeactivateSelfError when deactivating self", async () => {
    await expect(
      deactivateUser("user-1", "user-1")
    ).rejects.toThrow(CannotDeactivateSelfError);
  });

  it("should throw UserNotFoundError when user does not exist", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(
      deactivateUser("non-existent", "user-1")
    ).rejects.toThrow(UserNotFoundError);
  });
});

// ============================================
// reactivateUser
// ============================================

describe("reactivateUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should reactivate an inactive user", async () => {
    const inactiveUser = createMockUser({ active: false });
    const reactivatedUser = createMockUser({ active: true });

    prismaMock.user.findUnique.mockResolvedValue(inactiveUser);
    prismaMock.user.update.mockResolvedValue(reactivatedUser);

    const result = await reactivateUser("user-1");

    expect(result.active).toBe(true);
  });

  it("should throw UserNotFoundError when user does not exist", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(reactivateUser("non-existent")).rejects.toThrow(UserNotFoundError);
  });
});

// ============================================
// updateUserRole
// ============================================

describe("updateUserRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update another user's role", async () => {
    const targetUser = createMockUser({ id: "user-2", role: UserRole.OPERATOR });
    const updatedUser = createMockUser({ id: "user-2", role: UserRole.ADMIN });

    prismaMock.user.findUnique.mockResolvedValue(targetUser);
    prismaMock.user.update.mockResolvedValue(updatedUser);

    const result = await updateUserRole("user-2", UserRole.ADMIN, "user-1");

    expect(result.role).toBe(UserRole.ADMIN);
  });

  it("should throw CannotDeactivateSelfError when changing own role", async () => {
    await expect(
      updateUserRole("user-1", UserRole.OPERATOR, "user-1")
    ).rejects.toThrow(CannotDeactivateSelfError);
  });

  it("should throw UserNotFoundError when user does not exist", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(
      updateUserRole("non-existent", UserRole.ADMIN, "user-1")
    ).rejects.toThrow(UserNotFoundError);
  });
});

// ============================================
// changePassword
// ============================================

describe("changePassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should change password with valid current password", async () => {
    prismaMock.user.findUnique.mockResolvedValue(createMockUser());
    prismaMock.user.update.mockResolvedValue(createMockUser());

    const { default: bcrypt } = await import("bcryptjs");
    (bcrypt.compare as any).mockResolvedValue(true);

    await expect(
      changePassword({
        userId: "user-1",
        currentPassword: "OldSecure1",
        newPassword: "NewSecure1",
      })
    ).resolves.toBeUndefined();

    expect(prismaMock.user.update).toHaveBeenCalledOnce();
  });

  it("should throw InvalidCredentialsError for wrong current password", async () => {
    prismaMock.user.findUnique.mockResolvedValue(createMockUser());

    const { default: bcrypt } = await import("bcryptjs");
    (bcrypt.compare as any).mockResolvedValue(false);

    await expect(
      changePassword({
        userId: "user-1",
        currentPassword: "WrongPassword1",
        newPassword: "NewSecure1",
      })
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it("should throw InvalidPasswordError for weak new password", async () => {
    prismaMock.user.findUnique.mockResolvedValue(createMockUser());

    const { default: bcrypt } = await import("bcryptjs");
    (bcrypt.compare as any).mockResolvedValue(true);

    await expect(
      changePassword({
        userId: "user-1",
        currentPassword: "OldSecure1",
        newPassword: "weak",
      })
    ).rejects.toThrow(InvalidPasswordError);
  });

  it("should throw UserNotFoundError when user does not exist", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(
      changePassword({
        userId: "non-existent",
        currentPassword: "OldSecure1",
        newPassword: "NewSecure1",
      })
    ).rejects.toThrow(UserNotFoundError);
  });
});

// ============================================
// resetPassword
// ============================================

describe("resetPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should reset password for existing user", async () => {
    prismaMock.user.findUnique.mockResolvedValue(createMockUser());
    prismaMock.user.update.mockResolvedValue(createMockUser());

    await expect(
      resetPassword({
        userId: "user-1",
        newPassword: "NewSecure1",
        resetById: "admin-1",
      })
    ).resolves.toBeUndefined();

    expect(prismaMock.user.update).toHaveBeenCalledOnce();
  });

  it("should throw InvalidPasswordError for weak new password", async () => {
    prismaMock.user.findUnique.mockResolvedValue(createMockUser());

    await expect(
      resetPassword({
        userId: "user-1",
        newPassword: "123",
        resetById: "admin-1",
      })
    ).rejects.toThrow(InvalidPasswordError);
  });

  it("should throw UserNotFoundError when user does not exist", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(
      resetPassword({
        userId: "non-existent",
        newPassword: "NewSecure1",
        resetById: "admin-1",
      })
    ).rejects.toThrow(UserNotFoundError);
  });
});
