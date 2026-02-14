"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import CreatePaymentModal from "@/components/payments/CreatePaymentModal";

interface Payment {
  id: string;
  totalAmount: string;
  capitalApplied: string;
  interestApplied: string;
  lateFeeApplied: string;
  type: string;
  paymentDate: string;
  loan: {
    id: string;
    client: {
      id: string;
      firstName: string;
      lastName: string | null;
      documentId: string;
    };
  };
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface PaginatedPayments {
  data: Payment[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export default function PaymentsPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<PaginatedPayments | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filters, setFilters] = useState({
    type: "",
    dateFrom: "",
    dateTo: "",
  });

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      
      if (filters.type) params.set("type", filters.type);
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.set("dateTo", filters.dateTo);

      const res = await fetch(`/api/payments?${params}`);

      if (!res.ok) {
        throw new Error("Error al cargar los pagos");
      }

      const data = await res.json();
      setPayments(data);
    } catch (error) {
      console.error("Error fetching payments:", error);
      setPayments({ 
        data: [], 
        pagination: { total: 0, page: 1, limit: 20, totalPages: 0, hasNext: false, hasPrev: false } 
      });
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const fmt = (n: string | number) => Number(n).toLocaleString("es-DO", { minimumFractionDigits: 2 });

  const typeLabels: Record<string, string> = {
    REGULAR: "Regular",
    PARTIAL: "Parcial",
    TOTAL: "Total",
  };

  const typeColors: Record<string, { bg: string; color: string }> = {
    REGULAR: { bg: "#dbeafe", color: "#2563eb" },
    PARTIAL: { bg: "#fef3c7", color: "#d97706" },
    TOTAL: { bg: "#d1fae5", color: "#059669" },
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Pagos</h1>
          <p className="page-subtitle">
            {payments?.pagination.total ?? 0} pagos registrados
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Registrar Pago
        </button>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <select
          className="filter-select"
          value={filters.type}
          onChange={(e) => {
            setFilters({ ...filters, type: e.target.value });
            setPage(1);
          }}
        >
          <option value="">Todos los tipos</option>
          <option value="REGULAR">Regular</option>
          <option value="PARTIAL">Parcial</option>
          <option value="TOTAL">Total</option>
        </select>

        <input
          type="date"
          className="filter-input"
          value={filters.dateFrom}
          onChange={(e) => {
            setFilters({ ...filters, dateFrom: e.target.value });
            setPage(1);
          }}
          placeholder="Desde"
        />

        <input
          type="date"
          className="filter-input"
          value={filters.dateTo}
          onChange={(e) => {
            setFilters({ ...filters, dateTo: e.target.value });
            setPage(1);
          }}
          placeholder="Hasta"
        />

        {(filters.type || filters.dateFrom || filters.dateTo) && (
          <button
            className="btn-clear-filters"
            onClick={() => {
              setFilters({ type: "", dateFrom: "", dateTo: "" });
              setPage(1);
            }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Monto Total</th>
              <th>Capital</th>
              <th>Interés</th>
              <th>Mora</th>
              <th>Tipo</th>
              <th>Registrado por</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="table-empty">Cargando...</td></tr>
            ) : !payments?.data.length ? (
              <tr><td colSpan={9} className="table-empty">
                {filters.type || filters.dateFrom || filters.dateTo 
                  ? "No se encontraron pagos con los filtros aplicados" 
                  : "No hay pagos registrados"}
              </td></tr>
            ) : (
              payments.data.map((payment) => {
                const tc = typeColors[payment.type] || typeColors.REGULAR;
                return (
                  <tr 
                    key={payment.id} 
                    className="table-row"
                    onClick={() => router.push(`/dashboard/payments/${payment.id}`)}
                  >
                    <td className="td-bold">
                      {new Date(payment.paymentDate).toLocaleDateString("es-DO")}
                    </td>
                    <td>
                      <div className="client-info">
                        <div className="client-avatar-small">
                          {payment.loan.client.firstName[0]}{payment.loan.client.lastName?.[0] ?? ""}
                        </div>
                        <div>
                          <div className="client-name-small">
                            {payment.loan.client.firstName} {payment.loan.client.lastName ?? ""}
                          </div>
                          <div className="client-doc-small">{payment.loan.client.documentId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="td-bold td-amount">RD$ {fmt(payment.totalAmount)}</td>
                    <td>RD$ {fmt(payment.capitalApplied)}</td>
                    <td className="td-secondary">RD$ {fmt(payment.interestApplied)}</td>
                    <td className="td-secondary">RD$ {fmt(payment.lateFeeApplied)}</td>
                    <td>
                      <span className="type-badge" style={{ background: tc.bg, color: tc.color }}>
                        {typeLabels[payment.type] ?? payment.type}
                      </span>
                    </td>
                    <td className="td-secondary">
                      {payment.createdBy.firstName} {payment.createdBy.lastName}
                    </td>
                    <td>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {payments && payments.pagination.totalPages > 1 && (
        <div className="pagination">
          <button
            className="pagination-btn"
            disabled={!payments.pagination.hasPrev}
            onClick={() => setPage(page - 1)}
          >
            Anterior
          </button>
          <span className="pagination-info">
            Página {payments.pagination.page} de {payments.pagination.totalPages}
          </span>
          <button
            className="pagination-btn"
            disabled={!payments.pagination.hasNext}
            onClick={() => setPage(page + 1)}
          >
            Siguiente
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <CreatePaymentModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            fetchPayments();
          }}
        />
      )}

      <style jsx>{`
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
        }
        .page-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: #111827;
          letter-spacing: -0.02em;
        }
        .page-subtitle {
          font-size: 0.85rem;
          color: #6b7280;
          margin-top: 2px;
        }
        .btn-primary {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #2563eb;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 10px 18px;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }
        .btn-primary:hover {
          background: #1d4ed8;
        }

        .filters-bar {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }
        .filter-select,
        .filter-input {
          height: 40px;
          padding: 0 12px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 0.875rem;
          background: white;
          outline: none;
        }
        .filter-select {
          min-width: 180px;
        }
        .filter-input {
          min-width: 150px;
        }
        .filter-select:focus,
        .filter-input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }
        .btn-clear-filters {
          height: 40px;
          padding: 0 16px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: white;
          color: #6b7280;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.15s;
        }
        .btn-clear-filters:hover {
          border-color: #dc2626;
          color: #dc2626;
          background: #fef2f2;
        }

        .table-container {
          background: white;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          overflow-x: auto;
        }
        .table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
        }
        .table thead {
          background: #f9fafb;
        }
        .table th {
          text-align: left;
          padding: 12px 16px;
          font-weight: 600;
          color: #6b7280;
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          border-bottom: 1px solid #e5e7eb;
          white-space: nowrap;
        }
        .table td {
          padding: 12px 16px;
          color: #374151;
          border-bottom: 1px solid #f3f4f6;
        }
        .table-row {
          cursor: pointer;
          transition: background 0.1s;
        }
        .table-row:hover {
          background: #f9fafb;
        }
        .table-empty {
          text-align: center;
          padding: 40px 16px !important;
          color: #9ca3af;
        }

        .client-info {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .client-avatar-small {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          background: #dbeafe;
          color: #2563eb;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.65rem;
          font-weight: 700;
          flex-shrink: 0;
        }
        .client-name-small {
          font-size: 0.875rem;
          font-weight: 500;
          color: #111827;
        }
        .client-doc-small {
          font-size: 0.75rem;
          color: #9ca3af;
          font-family: monospace;
        }

        .td-bold {
          font-weight: 600;
        }
        .td-amount {
          color: #059669;
        }
        .td-secondary {
          color: #9ca3af;
        }

        .type-badge {
          font-size: 0.75rem;
          font-weight: 600;
          padding: 3px 10px;
          border-radius: 12px;
          white-space: nowrap;
        }

        .pagination {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          margin-top: 16px;
        }
        .pagination-btn {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 8px 16px;
          font-size: 0.85rem;
          color: #374151;
          cursor: pointer;
          transition: all 0.15s;
        }
        .pagination-btn:hover:not(:disabled) {
          border-color: #2563eb;
          color: #2563eb;
        }
        .pagination-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .pagination-info {
          font-size: 0.825rem;
          color: #6b7280;
        }
      `}</style>
    </div>
  );
}
