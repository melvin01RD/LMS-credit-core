import { describe, it, expect, vi, beforeEach } from "vitest";
import "./setup";
import { createClient } from "../../../lib/services/client.service";
import { InvalidClientDataError, DuplicateDocumentError } from "../../../lib/errors";
import { prismaMock } from "./prisma.mock";
import { createMockClient } from "./test-factories";

describe("createClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // HAPPY PATH
  // ============================================

  it("should create a client with valid data", async () => {
    const mockClient = createMockClient();
    prismaMock.client.findUnique.mockResolvedValue(null); // no duplicate
    prismaMock.client.create.mockResolvedValue(mockClient);

    const result = await createClient({
      firstName: "Juan",
      lastName: "Pérez",
      documentId: "001-1234567-8",
      phone: "809-555-1234",
      email: "juan@test.com",
      address: "Calle Principal #123",
    });

    expect(result.id).toBe("client-1");
    expect(prismaMock.client.create).toHaveBeenCalledOnce();
  });

  it("should default currency to DOP", async () => {
    const mockClient = createMockClient({ currency: "DOP" });
    prismaMock.client.findUnique.mockResolvedValue(null);
    prismaMock.client.create.mockResolvedValue(mockClient);

    await createClient({
      firstName: "Juan",
      documentId: "001-1234567-8",
      phone: "809-555-1234",
    });

    const callArgs = prismaMock.client.create.mock.calls[0][0];
    expect(callArgs.data.currency).toBe("DOP");
  });

  it("should trim whitespace from input fields", async () => {
    const mockClient = createMockClient();
    prismaMock.client.findUnique.mockResolvedValue(null);
    prismaMock.client.create.mockResolvedValue(mockClient);

    await createClient({
      firstName: "  Juan  ",
      lastName: "  Pérez  ",
      documentId: "  001-1234567-8  ",
      phone: "  809-555-1234  ",
      email: "juan@test.com",
      address: "  Calle Principal #123  ",
    });

    const callArgs = prismaMock.client.create.mock.calls[0][0];
    expect(callArgs.data.firstName).toBe("Juan");
    expect(callArgs.data.lastName).toBe("Pérez");
    expect(callArgs.data.documentId).toBe("001-1234567-8");
    expect(callArgs.data.phone).toBe("809-555-1234");
    expect(callArgs.data.email).toBe("juan@test.com");
    expect(callArgs.data.address).toBe("Calle Principal #123");
  });

  it("should allow creating client without optional fields", async () => {
    const mockClient = createMockClient({ lastName: undefined, email: undefined, address: undefined });
    prismaMock.client.findUnique.mockResolvedValue(null);
    prismaMock.client.create.mockResolvedValue(mockClient);

    const result = await createClient({
      firstName: "Juan",
      documentId: "001-1234567-8",
      phone: "809-555-1234",
    });

    expect(result).toBeDefined();
    expect(prismaMock.client.create).toHaveBeenCalledOnce();
  });

  // ============================================
  // DUPLICATE DOCUMENT
  // ============================================

  it("should throw DuplicateDocumentError when documentId already exists", async () => {
    prismaMock.client.findUnique.mockResolvedValue(createMockClient());

    await expect(
      createClient({
        firstName: "Otro",
        documentId: "001-1234567-8",
        phone: "809-555-9999",
      })
    ).rejects.toThrow(DuplicateDocumentError);
  });

  // ============================================
  // VALIDATION ERRORS
  // ============================================

  it("should throw InvalidClientDataError for short firstName", async () => {
    await expect(
      createClient({
        firstName: "J",
        documentId: "001-1234567-8",
        phone: "809-555-1234",
      })
    ).rejects.toThrow(InvalidClientDataError);
  });

  it("should throw InvalidClientDataError for empty firstName", async () => {
    await expect(
      createClient({
        firstName: "",
        documentId: "001-1234567-8",
        phone: "809-555-1234",
      })
    ).rejects.toThrow(InvalidClientDataError);
  });

  it("should throw InvalidClientDataError for short documentId", async () => {
    await expect(
      createClient({
        firstName: "Juan",
        documentId: "123",
        phone: "809-555-1234",
      })
    ).rejects.toThrow(InvalidClientDataError);
  });

  it("should throw InvalidClientDataError for short phone", async () => {
    await expect(
      createClient({
        firstName: "Juan",
        documentId: "001-1234567-8",
        phone: "123",
      })
    ).rejects.toThrow(InvalidClientDataError);
  });

  it("should throw InvalidClientDataError for invalid email format", async () => {
    await expect(
      createClient({
        firstName: "Juan",
        documentId: "001-1234567-8",
        phone: "809-555-1234",
        email: "not-an-email",
      })
    ).rejects.toThrow(InvalidClientDataError);
  });
});
