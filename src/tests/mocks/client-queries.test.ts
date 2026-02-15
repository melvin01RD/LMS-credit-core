import { describe, it, expect, vi, beforeEach } from "vitest";
import "./setup";
import {
  getClientById,
  getClientByDocument,
  getClients,
  searchClients,
  isDocumentRegistered,
} from "../../../lib/services/client.service";
import { ClientNotFoundError } from "../../../lib/errors";
import { prismaMock } from "./prisma.mock";
import { createMockClient } from "./test-factories";

describe("getClientById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return client with loans", async () => {
    const mockClient = { ...createMockClient(), loans: [] };
    prismaMock.client.findUnique.mockResolvedValue(mockClient);

    const result = await getClientById("client-1");

    expect(result.id).toBe("client-1");
    expect(result.firstName).toBe("Juan");
    expect(prismaMock.client.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "client-1" },
        include: expect.objectContaining({ loans: expect.any(Object) }),
      })
    );
  });

  it("should throw ClientNotFoundError when client does not exist", async () => {
    prismaMock.client.findUnique.mockResolvedValue(null);

    await expect(getClientById("non-existent")).rejects.toThrow(ClientNotFoundError);
  });
});

describe("getClientByDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return client by documentId", async () => {
    const mockClient = createMockClient();
    prismaMock.client.findUnique.mockResolvedValue(mockClient);

    const result = await getClientByDocument("001-1234567-8");

    expect(result.documentId).toBe("001-1234567-8");
  });

  it("should throw ClientNotFoundError when document not found", async () => {
    prismaMock.client.findUnique.mockResolvedValue(null);

    await expect(getClientByDocument("999-9999999-9")).rejects.toThrow(ClientNotFoundError);
  });
});

describe("getClients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return paginated clients without filters", async () => {
    const mockClients = [createMockClient(), createMockClient({ id: "client-2" })];
    prismaMock.client.findMany.mockResolvedValue(mockClients);
    prismaMock.client.count.mockResolvedValue(2);

    const result = await getClients();

    expect(result.data).toHaveLength(2);
    expect(result.pagination.total).toBe(2);
    expect(result.pagination.page).toBe(1);
  });

  it("should apply search filter across multiple fields", async () => {
    prismaMock.client.findMany.mockResolvedValue([createMockClient()]);
    prismaMock.client.count.mockResolvedValue(1);

    await getClients({ search: "Juan" });

    const callArgs = prismaMock.client.findMany.mock.calls[0][0];
    expect(callArgs.where.OR).toBeDefined();
    expect(callArgs.where.OR).toHaveLength(5); // firstName, lastName, documentId, phone, email
  });

  it("should filter by active status", async () => {
    prismaMock.client.findMany.mockResolvedValue([]);
    prismaMock.client.count.mockResolvedValue(0);

    await getClients({ active: true });

    const callArgs = prismaMock.client.findMany.mock.calls[0][0];
    expect(callArgs.where.active).toBe(true);
  });

  it("should filter by currency", async () => {
    prismaMock.client.findMany.mockResolvedValue([]);
    prismaMock.client.count.mockResolvedValue(0);

    await getClients({ currency: "DOP" });

    const callArgs = prismaMock.client.findMany.mock.calls[0][0];
    expect(callArgs.where.currency).toBe("DOP");
  });

  it("should handle custom pagination", async () => {
    prismaMock.client.findMany.mockResolvedValue([]);
    prismaMock.client.count.mockResolvedValue(50);

    const result = await getClients({}, { page: 3, limit: 10 });

    expect(result.pagination.page).toBe(3);
    expect(result.pagination.limit).toBe(10);
    expect(result.pagination.totalPages).toBe(5);
    expect(result.pagination.hasNext).toBe(true);
    expect(result.pagination.hasPrev).toBe(true);
  });

  it("should calculate hasNext and hasPrev correctly on first page", async () => {
    prismaMock.client.findMany.mockResolvedValue([]);
    prismaMock.client.count.mockResolvedValue(30);

    const result = await getClients({}, { page: 1, limit: 20 });

    expect(result.pagination.hasNext).toBe(true);
    expect(result.pagination.hasPrev).toBe(false);
  });

  it("should calculate hasNext and hasPrev correctly on last page", async () => {
    prismaMock.client.findMany.mockResolvedValue([]);
    prismaMock.client.count.mockResolvedValue(30);

    const result = await getClients({}, { page: 2, limit: 20 });

    expect(result.pagination.hasNext).toBe(false);
    expect(result.pagination.hasPrev).toBe(true);
  });
});

describe("searchClients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return matching clients", async () => {
    const mockResults = [
      { id: "client-1", firstName: "Juan", lastName: "Pérez", documentId: "001-1234567-8", phone: "809-555-1234" },
    ];
    prismaMock.client.findMany.mockResolvedValue(mockResults);

    const result = await searchClients("Juan");

    expect(result).toHaveLength(1);
    expect(prismaMock.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ active: true }),
      })
    );
  });

  it("should return empty array for short search term", async () => {
    const result = await searchClients("J");

    expect(result).toEqual([]);
    expect(prismaMock.client.findMany).not.toHaveBeenCalled();
  });

  it("should return empty array for empty search term", async () => {
    const result = await searchClients("");

    expect(result).toEqual([]);
    expect(prismaMock.client.findMany).not.toHaveBeenCalled();
  });

  it("should respect custom limit", async () => {
    prismaMock.client.findMany.mockResolvedValue([]);

    await searchClients("Juan", 5);

    const callArgs = prismaMock.client.findMany.mock.calls[0][0];
    expect(callArgs.take).toBe(5);
  });
});

describe("isDocumentRegistered", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return true when document exists", async () => {
    prismaMock.client.count.mockResolvedValue(1);

    const result = await isDocumentRegistered("001-1234567-8");

    expect(result).toBe(true);
  });

  it("should return false when document does not exist", async () => {
    prismaMock.client.count.mockResolvedValue(0);

    const result = await isDocumentRegistered("999-9999999-9");

    expect(result).toBe(false);
  });

  it("should exclude a specific client when checking", async () => {
    prismaMock.client.count.mockResolvedValue(0);

    await isDocumentRegistered("001-1234567-8", "client-1");

    const callArgs = prismaMock.client.count.mock.calls[0][0];
    expect(callArgs.where.id).toEqual({ not: "client-1" });
  });
});
