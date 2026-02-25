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

  const validInput = {
    firstName: "Juan",
    lastName: "Pérez",
    documentId: "00112345678",
    phone: "8291234567",
    email: "juan@test.com",
    address: "Calle Principal 123",
  };

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
      documentId: "00112345678",
      phone: "8091234567",
      email: "juan@test.com",
      address: "Calle Principal 123",
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
      documentId: "00112345678",
      phone: "8091234567",
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
      documentId: "  00112345678  ",
      phone: "  8091234567  ",
      email: "juan@test.com",
      address: "  Calle Principal 123  ",
    });

    const callArgs = prismaMock.client.create.mock.calls[0][0];
    expect(callArgs.data.firstName).toBe("Juan");
    expect(callArgs.data.lastName).toBe("Pérez");
    expect(callArgs.data.documentId).toBe("00112345678");
    expect(callArgs.data.phone).toBe("8091234567");
    expect(callArgs.data.email).toBe("juan@test.com");
    expect(callArgs.data.address).toBe("Calle Principal 123");
  });

  it("should allow creating client without optional fields", async () => {
    const mockClient = createMockClient({ lastName: undefined, email: undefined, address: undefined });
    prismaMock.client.findUnique.mockResolvedValue(null);
    prismaMock.client.create.mockResolvedValue(mockClient);

    const result = await createClient({
      firstName: "Juan",
      documentId: "00112345678",
      phone: "8091234567",
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
        documentId: "00112345678",
        phone: "8295559999",
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
        documentId: "00112345678",
        phone: "8091234567",
      })
    ).rejects.toThrow(InvalidClientDataError);
  });

  it("should throw InvalidClientDataError for empty firstName", async () => {
    await expect(
      createClient({
        firstName: "",
        documentId: "00112345678",
        phone: "8091234567",
      })
    ).rejects.toThrow(InvalidClientDataError);
  });

  it("should throw InvalidClientDataError for short documentId", async () => {
    await expect(
      createClient({
        firstName: "Juan",
        documentId: "123",
        phone: "8091234567",
      })
    ).rejects.toThrow(InvalidClientDataError);
  });

  it("should throw InvalidClientDataError for short phone", async () => {
    await expect(
      createClient({
        firstName: "Juan",
        documentId: "00112345678",
        phone: "123",
      })
    ).rejects.toThrow(InvalidClientDataError);
  });

  it("should throw InvalidClientDataError for invalid email format", async () => {
    await expect(
      createClient({
        firstName: "Juan",
        documentId: "00112345678",
        phone: "8091234567",
        email: "not-an-email",
      })
    ).rejects.toThrow(InvalidClientDataError);
  });

  // ============================================
  // NUEVAS VALIDACIONES: documentId exactamente 11 dígitos numéricos
  // ============================================

  it("debe rechazar cédula con menos de 11 dígitos", async () => {
    await expect(createClient({ ...validInput, documentId: "1234567890" }))
      .rejects.toThrow("exactamente 11 dígitos numéricos");
  });

  it("debe rechazar cédula con más de 11 dígitos", async () => {
    await expect(createClient({ ...validInput, documentId: "123456789012" }))
      .rejects.toThrow("exactamente 11 dígitos numéricos");
  });

  it("debe rechazar cédula con caracteres no numéricos", async () => {
    await expect(createClient({ ...validInput, documentId: "1234567890A" }))
      .rejects.toThrow("exactamente 11 dígitos numéricos");
  });

  // ============================================
  // NUEVAS VALIDACIONES: phone exactamente 10 dígitos numéricos
  // ============================================

  it("debe rechazar teléfono con menos de 10 dígitos", async () => {
    await expect(createClient({ ...validInput, phone: "829123456" }))
      .rejects.toThrow("exactamente 10 dígitos numéricos");
  });

  it("debe rechazar teléfono con caracteres no numéricos", async () => {
    await expect(createClient({ ...validInput, phone: "829-123-456" }))
      .rejects.toThrow("exactamente 10 dígitos numéricos");
  });

  // ============================================
  // NUEVAS VALIDACIONES: firstName máximo 25 caracteres
  // ============================================

  it("debe rechazar nombre con más de 25 caracteres", async () => {
    await expect(createClient({ ...validInput, firstName: "A".repeat(26) }))
      .rejects.toThrow("no puede tener más de 25 caracteres");
  });

  // ============================================
  // NUEVAS VALIDACIONES: lastName máximo 25 caracteres
  // ============================================

  it("debe rechazar apellido con más de 25 caracteres", async () => {
    await expect(createClient({ ...validInput, lastName: "B".repeat(26) }))
      .rejects.toThrow("no puede tener más de 25 caracteres");
  });

  // ============================================
  // NUEVAS VALIDACIONES: address máximo 50 caracteres
  // ============================================

  it("debe rechazar dirección con más de 50 caracteres", async () => {
    await expect(createClient({ ...validInput, address: "C".repeat(51) }))
      .rejects.toThrow("no puede tener más de 50 caracteres");
  });

  // ============================================
  // CASOS VÁLIDOS NUEVAS REGLAS
  // ============================================

  it("debe aceptar cédula de exactamente 11 dígitos", async () => {
    prismaMock.client.findUnique.mockResolvedValue(null);
    prismaMock.client.create.mockResolvedValue({ ...createMockClient(), documentId: "00112345678" });
    await expect(createClient({ ...validInput, documentId: "00112345678" })).resolves.toBeDefined();
  });

  it("debe aceptar teléfono de exactamente 10 dígitos", async () => {
    prismaMock.client.findUnique.mockResolvedValue(null);
    prismaMock.client.create.mockResolvedValue({ ...createMockClient() });
    await expect(createClient({ ...validInput, phone: "8291234567" })).resolves.toBeDefined();
  });
});
