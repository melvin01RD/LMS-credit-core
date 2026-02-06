/**
 * Errores personalizados para la capa de servicios
 */

export class ServiceError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string, statusCode: number = 400) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

// CLIENT ERRORS
export class ClientNotFoundError extends ServiceError {
  constructor(identifier: string) {
    super(`Cliente no encontrado: ${identifier}`, "CLIENT_NOT_FOUND", 404);
  }
}

export class DuplicateDocumentError extends ServiceError {
  constructor(documentId: string) {
    super(`Ya existe un cliente con el documento: ${documentId}`, "DUPLICATE_DOCUMENT", 409);
  }
}

export class ClientHasActiveLoansError extends ServiceError {
  constructor(clientId: string, loanCount: number) {
    super(`No se puede eliminar el cliente ${clientId}. Tiene ${loanCount} préstamo(s) activo(s)`, "CLIENT_HAS_ACTIVE_LOANS", 409);
  }
}

export class InvalidClientDataError extends ServiceError {
  constructor(message: string) {
    super(message, "INVALID_CLIENT_DATA", 400);
  }
}