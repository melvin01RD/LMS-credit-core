import { describe, it, expect, vi, beforeEach } from "vitest";
import "./setup";
import { updateClient } from "../../../lib/services/client.service";
import { ClientNotFoundError, InvalidClientDataError } from "../../../lib/errors";
import { prismaMock } from "./prisma.mock";
import { createMockClient } from "./test-factories";

describe("updateClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update client fields", async () => {
    const existingClient = createMockClient();
    const updatedClient = createMockClient({ firstName: "Carlos", phone: "8295559999" });

    prismaMock.client.findUnique.mockResolvedValue(existingClient);
    prismaMock.client.update.mockResolvedValue(updatedClient);

    const result = await updateClient("client-1", {
      firstName: "Carlos",
      phone: "8295559999",
    });

    expect(result.firstName).toBe("Carlos");
    expect(prismaMock.client.update).toHaveBeenCalledOnce();
  });

  it("should trim updated fields", async () => {
    const existingClient = createMockClient();
    prismaMock.client.findUnique.mockResolvedValue(existingClient);
    prismaMock.client.update.mockResolvedValue(createMockClient());

    await updateClient("client-1", {
      firstName: "  Carlos  ",
      email: "carlos@test.com",
    });

    const callArgs = prismaMock.client.update.mock.calls[0][0];
    expect(callArgs.data.firstName).toBe("Carlos");
    expect(callArgs.data.email).toBe("carlos@test.com");
  });

  it("should allow partial updates", async () => {
    prismaMock.client.findUnique.mockResolvedValue(createMockClient());
    prismaMock.client.update.mockResolvedValue(createMockClient());

    await updateClient("client-1", { firstName: "Carlos" });

    const callArgs = prismaMock.client.update.mock.calls[0][0];
    expect(callArgs.data.firstName).toBe("Carlos");
    expect(callArgs.data.phone).toBeUndefined();
  });

  it("should throw ClientNotFoundError when client does not exist", async () => {
    prismaMock.client.findUnique.mockResolvedValue(null);

    await expect(
      updateClient("non-existent", { firstName: "Carlos" })
    ).rejects.toThrow(ClientNotFoundError);
  });

  it("should throw InvalidClientDataError for invalid phone on update", async () => {
    prismaMock.client.findUnique.mockResolvedValue(createMockClient());

    await expect(
      updateClient("client-1", { phone: "123" })
    ).rejects.toThrow(InvalidClientDataError);
  });

  it("should throw InvalidClientDataError for invalid email on update", async () => {
    prismaMock.client.findUnique.mockResolvedValue(createMockClient());

    await expect(
      updateClient("client-1", { email: "bad-email" })
    ).rejects.toThrow(InvalidClientDataError);
  });
});
