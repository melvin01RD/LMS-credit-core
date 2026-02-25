
import { prisma } from "../db/prisma";
import { LoanStatus, Prisma } from "@prisma/client";
import {
  ClientNotFoundError,
  DuplicateDocumentError,
  ClientHasActiveLoansError,
  InvalidClientDataError,
} from "../errors";
import { PaginationOptions, PaginatedResult } from "../types";

// ============================================
// INTERFACES
// ============================================

export interface CreateClientInput {
  firstName: string;
  lastName?: string;
  documentId: string;
  phone: string;
  email?: string;
  address?: string;
  currency?: string;
}

export interface UpdateClientInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  address?: string;
  currency?: string;
}

export interface ClientFilters {
  search?: string;
  active?: boolean;
  currency?: string;
}

// ============================================
// VALIDATION
// ============================================

function validateFirstName(firstName: string): void {
  if (!firstName || firstName.trim().length < 2) {
    throw new InvalidClientDataError("El nombre debe tener al menos 2 caracteres");
  }
  if (firstName.trim().length > 25) {
    throw new InvalidClientDataError("El nombre no puede tener más de 25 caracteres");
  }
}

function validateLastName(lastName: string | undefined): void {
  if (lastName !== undefined && lastName !== null && lastName.trim().length > 0) {
    if (lastName.trim().length < 2) {
      throw new InvalidClientDataError("El apellido debe tener al menos 2 caracteres");
    }
    if (lastName.trim().length > 25) {
      throw new InvalidClientDataError("El apellido no puede tener más de 25 caracteres");
    }
  }
}

function validateDocumentId(documentId: string): void {
  if (!documentId || documentId.trim().length === 0) {
    throw new InvalidClientDataError("La cédula es requerida");
  }
  const cleaned = documentId.trim();
  if (!/^\d{11}$/.test(cleaned)) {
    throw new InvalidClientDataError("La cédula debe tener exactamente 11 dígitos numéricos");
  }
}

function validatePhone(phone: string): void {
  if (!phone || phone.trim().length === 0) {
    throw new InvalidClientDataError("El teléfono es requerido");
  }
  const cleaned = phone.trim();
  if (!/^\d{10}$/.test(cleaned)) {
    throw new InvalidClientDataError("El teléfono debe tener exactamente 10 dígitos numéricos");
  }
}

function validateAddress(address: string | undefined): void {
  if (address !== undefined && address !== null && address.trim().length > 50) {
    throw new InvalidClientDataError("La dirección no puede tener más de 50 caracteres");
  }
}

function validateEmail(email: string | undefined): void {
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new InvalidClientDataError("El formato del email es inválido");
  }
}

function validateCreateInput(data: CreateClientInput): void {
  validateFirstName(data.firstName);
  validateLastName(data.lastName);
  validateDocumentId(data.documentId);
  validatePhone(data.phone);
  validateAddress(data.address);
  validateEmail(data.email);
}

// ============================================
// CLIENT OPERATIONS
// ============================================

export async function createClient(data: CreateClientInput) {
  validateCreateInput(data);

  const existingClient = await prisma.client.findUnique({
    where: { documentId: data.documentId },
  });

  if (existingClient) {
    throw new DuplicateDocumentError(data.documentId);
  }

  return prisma.client.create({
    data: {
      firstName: data.firstName.trim(),
      lastName: data.lastName?.trim(),
      documentId: data.documentId.trim(),
      phone: data.phone.trim(),
      email: data.email?.trim(),
      address: data.address?.trim(),
      currency: data.currency ?? "DOP",
    },
  });
}

export async function getClientById(clientId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      loans: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  if (!client) {
    throw new ClientNotFoundError(clientId);
  }

  return client;
}

export async function getClientByDocument(documentId: string) {
  const client = await prisma.client.findUnique({
    where: { documentId },
  });

  if (!client) {
    throw new ClientNotFoundError(documentId);
  }

  return client;
}

export async function getClients(
  filters?: ClientFilters,
  pagination?: PaginationOptions
): Promise<PaginatedResult<Awaited<ReturnType<typeof prisma.client.findMany>>[number]>> {
  const page = pagination?.page ?? 1;
  const limit = pagination?.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: Prisma.ClientWhereInput = {};

  if (filters?.search) {
    const searchTerm = filters.search.trim();
    where.OR = [
      { firstName: { contains: searchTerm, mode: "insensitive" } },
      { lastName: { contains: searchTerm, mode: "insensitive" } },
      { documentId: { contains: searchTerm, mode: "insensitive" } },
      { phone: { contains: searchTerm } },
      { email: { contains: searchTerm, mode: "insensitive" } },
    ];
  }

  if (filters?.active !== undefined) {
    where.active = filters.active;
  }

  if (filters?.currency) {
    where.currency = filters.currency;
  }

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { loans: true },
        },
      },
    }),
    prisma.client.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    data: clients,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

export async function updateClient(clientId: string, data: UpdateClientInput) {
  const existingClient = await prisma.client.findUnique({
    where: { id: clientId },
  });

  if (!existingClient) {
    throw new ClientNotFoundError(clientId);
  }

  if (data.firstName !== undefined) validateFirstName(data.firstName);
  if (data.lastName !== undefined) validateLastName(data.lastName);
  if (data.phone !== undefined) validatePhone(data.phone);
  if (data.email !== undefined) validateEmail(data.email);
  if (data.address !== undefined) validateAddress(data.address);

  return prisma.client.update({
    where: { id: clientId },
    data: {
      firstName: data.firstName?.trim(),
      lastName: data.lastName?.trim(),
      phone: data.phone?.trim(),
      email: data.email?.trim(),
      address: data.address?.trim(),
      currency: data.currency,
    },
  });
}

export async function deactivateClient(clientId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      loans: {
        where: {
          status: { in: [LoanStatus.ACTIVE, LoanStatus.OVERDUE] },
        },
      },
    },
  });

  if (!client) {
    throw new ClientNotFoundError(clientId);
  }

  if (client.loans.length > 0) {
    throw new ClientHasActiveLoansError(clientId, client.loans.length);
  }

  return prisma.client.update({
    where: { id: clientId },
    data: { active: false },
  });
}

export async function reactivateClient(clientId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
  });

  if (!client) {
    throw new ClientNotFoundError(clientId);
  }

  return prisma.client.update({
    where: { id: clientId },
    data: { active: true },
  });
}

export async function deleteClient(clientId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      _count: {
        select: { loans: true },
      },
    },
  });

  if (!client) {
    throw new ClientNotFoundError(clientId);
  }

  if (client._count.loans > 0) {
    throw new ClientHasActiveLoansError(clientId, client._count.loans);
  }

  return prisma.client.delete({
    where: { id: clientId },
  });
}

export async function getClientWithLoanHistory(clientId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      loans: {
        orderBy: { createdAt: "desc" },
        include: {
          payments: {
            orderBy: { paymentDate: "desc" },
            take: 3,
          },
        },
      },
    },
  });

  if (!client) {
    throw new ClientNotFoundError(clientId);
  }

  const stats = {
    totalLoans: client.loans.length,
    activeLoans: client.loans.filter((l) => l.status === LoanStatus.ACTIVE).length,
    overdueLoans: client.loans.filter((l) => l.status === LoanStatus.OVERDUE).length,
    paidLoans: client.loans.filter((l) => l.status === LoanStatus.PAID).length,
    totalBorrowed: client.loans.reduce((sum, l) => sum + Number(l.principalAmount), 0),
    totalOutstanding: client.loans
      .filter((l) => l.status === LoanStatus.ACTIVE || l.status === LoanStatus.OVERDUE)
      .reduce((sum, l) => sum + Number(l.remainingCapital), 0),
  };

  return { client, stats };
}

export async function searchClients(searchTerm: string, limit: number = 10) {
  if (!searchTerm || searchTerm.trim().length < 2) {
    return [];
  }

  const term = searchTerm.trim();

  return prisma.client.findMany({
    where: {
      active: true,
      OR: [
        { firstName: { contains: term, mode: "insensitive" } },
        { lastName: { contains: term, mode: "insensitive" } },
        { documentId: { contains: term, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      documentId: true,
      phone: true,
    },
    take: limit,
    orderBy: { firstName: "asc" },
  });
}

export async function isDocumentRegistered(
  documentId: string,
  excludeClientId?: string
): Promise<boolean> {
  const where: Prisma.ClientWhereInput = { documentId };

  if (excludeClientId) {
    where.id = { not: excludeClientId };
  }

  const count = await prisma.client.count({ where });
  return count > 0;
}
