import { describe, it, expect, vi, beforeEach } from "vitest";
import "./setup";
import { getConfig, updateConfig } from "../../../lib/services/system-config.service";
import { LateFeeType } from "@prisma/client";
import { prismaMock } from "./prisma.mock";

// ============================================
// Helpers
// ============================================

const defaultConfig = {
  id: "singleton",
  businessName: "Mi Negocio",
  rnc: null,
  address: null,
  phone: null,
  email: null,
  lateFeeType: LateFeeType.PERCENTAGE_DAILY,
  lateFeeValue: 0,
  gracePeriodDays: 0,
  defaultMonthlyRate: null,
  defaultWeeklyRate: null,
  defaultDailyRate: null,
  updatedAt: new Date(),
  updatedById: null,
};

const validConfigData = {
  businessName: "LMS Credit Corp",
  rnc: "1-23-45678-9",
  address: "Av. Independencia 100",
  phone: "809-555-1234",
  email: "info@lmscredit.com",
  lateFeeType: LateFeeType.PERCENTAGE_DAILY,
  lateFeeValue: 1.5,
  gracePeriodDays: 3,
  defaultMonthlyRate: 3.5,
  defaultWeeklyRate: null,
  defaultDailyRate: null,
};

// ============================================
// getConfig()
// ============================================

describe("getConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna el registro existente cuando ya existe la configuración", async () => {
    const existingConfig = { ...defaultConfig, businessName: "Negocio Existente" };
    prismaMock.systemConfig.upsert.mockResolvedValue(existingConfig);

    const result = await getConfig();

    expect(prismaMock.systemConfig.upsert).toHaveBeenCalledOnce();
    expect(prismaMock.systemConfig.upsert).toHaveBeenCalledWith({
      where: { id: "singleton" },
      create: { id: "singleton" },
      update: {},
    });
    expect(result.businessName).toBe("Negocio Existente");
  });

  it("retorna defaults cuando no existe registro (upsert lo crea)", async () => {
    prismaMock.systemConfig.upsert.mockResolvedValue(defaultConfig);

    const result = await getConfig();

    expect(result.id).toBe("singleton");
    expect(result.businessName).toBe("Mi Negocio");
    expect(result.lateFeeType).toBe(LateFeeType.PERCENTAGE_DAILY);
    expect(result.gracePeriodDays).toBe(0);
    expect(result.lateFeeValue).toBe(0);
  });

  it("llama upsert con update vacío (no sobreescribe datos existentes)", async () => {
    prismaMock.systemConfig.upsert.mockResolvedValue(defaultConfig);

    await getConfig();

    const call = prismaMock.systemConfig.upsert.mock.calls[0][0];
    expect(call.update).toEqual({});
  });
});

// ============================================
// updateConfig()
// ============================================

describe("updateConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("actualiza la configuración con datos válidos", async () => {
    const updatedConfig = {
      ...defaultConfig,
      ...validConfigData,
      updatedById: "user-1",
    };
    prismaMock.systemConfig.upsert.mockResolvedValue(updatedConfig);

    const result = await updateConfig(validConfigData, "user-1");

    expect(prismaMock.systemConfig.upsert).toHaveBeenCalledOnce();
    expect(result.businessName).toBe("LMS Credit Corp");
    expect(result.updatedById).toBe("user-1");
  });

  it("persiste userId en updatedById", async () => {
    const updatedConfig = { ...defaultConfig, updatedById: "admin-42" };
    prismaMock.systemConfig.upsert.mockResolvedValue(updatedConfig);

    await updateConfig(validConfigData, "admin-42");

    const call = prismaMock.systemConfig.upsert.mock.calls[0][0];
    expect(call.update.updatedById).toBe("admin-42");
    expect(call.create.updatedById).toBe("admin-42");
  });

  it("usa id=singleton en el upsert", async () => {
    prismaMock.systemConfig.upsert.mockResolvedValue(defaultConfig);

    await updateConfig(validConfigData, "user-1");

    const call = prismaMock.systemConfig.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ id: "singleton" });
    expect(call.create.id).toBe("singleton");
  });

  it("acepta campos nullish opcionales como null", async () => {
    const dataWithNulls = {
      ...validConfigData,
      rnc: null,
      address: null,
      phone: null,
      email: null,
      defaultMonthlyRate: null,
      defaultWeeklyRate: null,
      defaultDailyRate: null,
    };
    prismaMock.systemConfig.upsert.mockResolvedValue(defaultConfig);

    await expect(updateConfig(dataWithNulls, "user-1")).resolves.toBeDefined();
  });

  it("acepta email vacío como cadena vacía (or literal '')", async () => {
    const dataWithEmptyEmail = { ...validConfigData, email: "" };
    prismaMock.systemConfig.upsert.mockResolvedValue(defaultConfig);

    await expect(updateConfig(dataWithEmptyEmail, "user-1")).resolves.toBeDefined();
  });

  it("acepta lateFeeType FIXED", async () => {
    const dataWithFixed = { ...validConfigData, lateFeeType: LateFeeType.FIXED };
    prismaMock.systemConfig.upsert.mockResolvedValue({
      ...defaultConfig,
      lateFeeType: LateFeeType.FIXED,
    });

    const result = await updateConfig(dataWithFixed, "user-1");

    expect(result.lateFeeType).toBe(LateFeeType.FIXED);
  });

  // ============================================
  // Zod validation failures
  // ============================================

  it("lanza ZodError cuando businessName está vacío", async () => {
    const badData = { ...validConfigData, businessName: "" };

    await expect(updateConfig(badData, "user-1")).rejects.toThrow();
    expect(prismaMock.systemConfig.upsert).not.toHaveBeenCalled();
  });

  it("lanza ZodError cuando lateFeeValue es negativo", async () => {
    const badData = { ...validConfigData, lateFeeValue: -1 };

    await expect(updateConfig(badData, "user-1")).rejects.toThrow();
    expect(prismaMock.systemConfig.upsert).not.toHaveBeenCalled();
  });

  it("lanza ZodError cuando gracePeriodDays es negativo", async () => {
    const badData = { ...validConfigData, gracePeriodDays: -1 };

    await expect(updateConfig(badData, "user-1")).rejects.toThrow();
    expect(prismaMock.systemConfig.upsert).not.toHaveBeenCalled();
  });

  it("lanza ZodError cuando gracePeriodDays no es entero", async () => {
    const badData = { ...validConfigData, gracePeriodDays: 1.5 };

    await expect(updateConfig(badData, "user-1")).rejects.toThrow();
    expect(prismaMock.systemConfig.upsert).not.toHaveBeenCalled();
  });

  it("lanza ZodError cuando email tiene formato inválido", async () => {
    const badData = { ...validConfigData, email: "no-es-un-email" };

    await expect(updateConfig(badData, "user-1")).rejects.toThrow();
    expect(prismaMock.systemConfig.upsert).not.toHaveBeenCalled();
  });

  it("lanza ZodError cuando lateFeeType tiene valor inválido", async () => {
    const badData = { ...validConfigData, lateFeeType: "INVALID_TYPE" as LateFeeType };

    await expect(updateConfig(badData, "user-1")).rejects.toThrow();
    expect(prismaMock.systemConfig.upsert).not.toHaveBeenCalled();
  });

  it("lanza error cuando data es undefined", async () => {
    await expect(updateConfig(undefined, "user-1")).rejects.toThrow();
    expect(prismaMock.systemConfig.upsert).not.toHaveBeenCalled();
  });
});
