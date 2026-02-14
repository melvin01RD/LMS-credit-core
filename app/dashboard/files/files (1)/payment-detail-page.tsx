"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Payment {
  id: string;
  totalAmount: string;
  capitalApplied: string;
  interestApplied: string;
  lateFeeApplied: string;
  type: string;
  paymentDate: string;
  createdAt: string;
  loan: {
    id: string;
    principalAmount: string;
    remainingCapital: string;
    annualInterestRate: string;
    status: string;
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
    email: string;
  };
}

export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showReverseConfirm, setShowReverseConfirm] = useState(false);
  const [reversing, setReversing] = useState(false);
  const [userId, setUserId] = useState("");

  // Obtener usuario actual
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data?.user) setUserId(data.user.userId);
      });
  }, []);

  useEffect(() => {
    async function fetchPayment() {
      try {
        const res = await fetch(`/api/payments/${id}`);
        if (!res.ok) {
          setError("Pago no encontrado");
          return;
        }
        const data = await res.json();
        setPayment(data);
      } catch {
        setError("Error al cargar el pago");
      } finally {
        setLoading(false);
      }
    }

    fetchPayment();
  }, [id]);

  async function handleReverse() {
    if (!userId) {
      setError("No se pudo obtener el usuario actual");
      return;
    }

    setReversing(true);
    setError("");

    try {
      const res = await fetch(`/api/payments/${id}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reversedById: userId,
          reason: "Reversión manual desde el sistema",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message ?? "Error al reversar el pago");
        return;
      }

      router.push("/dashboard/payments");
    } catch {
      setError("Error de conexión");
    } finally {
      setReversing(false);
      setShowReverseConfirm(false);
    }
  }

  if (loading) {
    return <div style={{ padding: "40px", textAlign: "center", color: "#9ca3af" }}>Cargando...</div>;
  }

  if (error || !payment) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <p style={{ color: "#dc2626", marginBottom: "16px" }}>{error}</p>
        <button
          onClick={() => router.push("/dashboard/payments")}
          style={{ color: "#2563eb", background: "none", border: "none", cursor: "pointer" }}
        >
          Volver a pagos
        </button>
      </div>
    );
  }

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

  const tc = typeColors[payment.type] || typeColors.REGULAR;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <Link href="/dashboard/payments" className="breadcrumb-link">Pagos</Link>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="breadcrumb-current">Detalle de pago</span>
      </div>

      {/* Payment header */}
      <div className="payment-header">
        <div className="payment-header-left">
          <div className="payment-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
          </div>
          <div>
            <h1 className="payment-amount">RD$ {fmt(payment.totalAmount)}</h1>
            <div className="payment-meta">
              <span className="type-badge" style={{ background: tc.bg, color: tc.color }}>
                {typeLabels[payment.type]}
              </span>
              <span>•</span>
              <span>{new Date(payment.paymentDate).toLocaleDateString("es-DO")}</span>
            </div>
          </div>
        </div>
        <button 
          className="btn-reverse"
          onClick={() => setShowReverseConfirm(true)}
          disabled={reversing}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
          Reversar Pago
        </button>
      </div>

      {/* Distribution */}
      <div className="section-title">Distribución del Pago</div>
      <div className="distribution-cards">
        <div className="dist-card">
          <div className="dist-icon" style={{ background: "#dbeafe" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div>
            <div className="dist-label">Capital</div>
            <div className="dist-value">RD$ {fmt(payment.capitalApplied)}</div>
          </div>
        </div>

        <div className="dist-card">
          <div className="dist-icon" style={{ background: "#fef3c7" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <div className="dist-label">Interés</div>
            <div className="dist-value">RD$ {fmt(payment.interestApplied)}</div>
          </div>
        </div>

        <div className="dist-card">
          <div className="dist-icon" style={{ background: "#fee2e2" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <div className="dist-label">Mora</div>
            <div className="dist-value">RD$ {fmt(payment.lateFeeApplied)}</div>
          </div>
        </div>
      </div>

      {/* Loan info */}
      <div className="section-title">Información del Préstamo</div>
      <div className="info-card">
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Cliente:</span>
            <Link href={`/dashboard/clients/${payment.loan.client.id}`} className="info-link">
              {payment.loan.client.firstName} {payment.loan.client.lastName ?? ""}
            </Link>
          </div>
          <div className="info-item">
            <span className="info-label">Documento:</span>
            <span className="info-value info-mono">{payment.loan.client.documentId}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Préstamo:</span>
            <Link href={`/dashboard/loans/${payment.loan.id}`} className="info-link">
              Ver detalles
            </Link>
          </div>
          <div className="info-item">
            <span className="info-label">Monto original:</span>
            <span className="info-value">RD$ {fmt(payment.loan.principalAmount)}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Saldo actual:</span>
            <span className="info-value info-value-amount">
              RD$ {fmt(payment.loan.remainingCapital)}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Tasa:</span>
            <span className="info-value">{Number(payment.loan.annualInterestRate)}% anual</span>
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="section-title">Información del Registro</div>
      <div className="info-card">
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Registrado por:</span>
            <span className="info-value">
              {payment.createdBy.firstName} {payment.createdBy.lastName}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Email:</span>
            <span className="info-value info-mono">{payment.createdBy.email}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Fecha de registro:</span>
            <span className="info-value">
              {new Date(payment.createdAt).toLocaleString("es-DO")}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">ID de pago:</span>
            <span className="info-value info-mono">{payment.id}</span>
          </div>
        </div>
      </div>

      {/* Reverse confirmation modal */}
      {showReverseConfirm && (
        <div className="modal-overlay" onClick={() => setShowReverseConfirm(false)}>
          <div className="modal-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon-warning">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h3 className="modal-confirm-title">¿Reversar este pago?</h3>
            <p className="modal-confirm-text">
              Esta acción creará un registro de reversión y actualizará el saldo del préstamo. 
              No se puede deshacer.
            </p>
            {error && <div className="modal-error">{error}</div>}
            <div className="modal-confirm-actions">
              <button 
                className="btn-cancel" 
                onClick={() => setShowReverseConfirm(false)}
                disabled={reversing}
              >
                Cancelar
              </button>
              <button 
                className="btn-danger" 
                onClick={handleReverse}
                disabled={reversing}
              >
                {reversing ? "Reversando..." : "Sí, reversar pago"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .breadcrumb {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 20px;
          font-size: 0.85rem;
        }
        .breadcrumb-link {
          color: #2563eb;
          text-decoration: none;
        }
        .breadcrumb-link:hover {
          text-decoration: underline;
        }
        .breadcrumb-current {
          color: #6b7280;
        }

        .payment-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }
        .payment-header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .payment-icon {
          width: 52px;
          height: 52px;
          border-radius: 12px;
          background: #059669;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .payment-amount {
          font-size: 1.5rem;
          font-weight: 700;
          color: #059669;
          letter-spacing: -0.02em;
        }
        .payment-meta {
          display: flex;
          gap: 8px;
          align-items: center;
          font-size: 0.85rem;
          color: #6b7280;
          margin-top: 4px;
        }
        .type-badge {
          font-size: 0.75rem;
          font-weight: 600;
          padding: 3px 10px;
          border-radius: 12px;
        }

        .btn-reverse {
          display: flex;
          align-items: center;
          gap: 8px;
          background: white;
          color: #dc2626;
          border: 1px solid #dc2626;
          border-radius: 8px;
          padding: 10px 18px;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }
        .btn-reverse:hover:not(:disabled) {
          background: #fef2f2;
        }
        .btn-reverse:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .section-title {
          font-size: 1rem;
          font-weight: 700;
          color: #111827;
          margin-bottom: 12px;
        }

        .distribution-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
          margin-bottom: 28px;
        }
        .dist-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 14px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .dist-icon {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .dist-label {
          font-size: 0.75rem;
          color: #9ca3af;
          margin-bottom: 2px;
        }
        .dist-value {
          font-size: 1rem;
          font-weight: 700;
          color: #111827;
        }

        .info-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 16px;
          margin-bottom: 20px;
        }
        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 16px;
        }
        .info-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .info-label {
          font-size: 0.75rem;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .info-value {
          font-size: 0.875rem;
          font-weight: 600;
          color: #111827;
        }
        .info-mono {
          font-family: monospace;
          font-size: 0.825rem;
        }
        .info-value-amount {
          color: #059669;
        }
        .info-link {
          font-size: 0.875rem;
          font-weight: 600;
          color: #2563eb;
          text-decoration: none;
        }
        .info-link:hover {
          text-decoration: underline;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 50;
          padding: 16px;
        }
        .modal-confirm {
          background: white;
          border-radius: 14px;
          width: 100%;
          max-width: 420px;
          padding: 24px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
          text-align: center;
        }
        .modal-icon-warning {
          width: 64px;
          height: 64px;
          margin: 0 auto 16px;
          border-radius: 50%;
          background: #fef2f2;
          color: #dc2626;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .modal-confirm-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: #111827;
          margin-bottom: 8px;
        }
        .modal-confirm-text {
          font-size: 0.875rem;
          color: #6b7280;
          line-height: 1.5;
          margin-bottom: 20px;
        }
        .modal-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          padding: 10px 14px;
          color: #dc2626;
          font-size: 0.85rem;
          margin-bottom: 16px;
        }
        .modal-confirm-actions {
          display: flex;
          gap: 10px;
        }
        .btn-cancel,
        .btn-danger {
          flex: 1;
          padding: 10px 20px;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }
        .btn-cancel {
          background: white;
          color: #374151;
          border: 1px solid #e5e7eb;
        }
        .btn-cancel:hover:not(:disabled) {
          background: #f9fafb;
        }
        .btn-danger {
          background: #dc2626;
          color: white;
          border: none;
        }
        .btn-danger:hover:not(:disabled) {
          background: #b91c1c;
        }
        .btn-cancel:disabled,
        .btn-danger:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        @media (max-width: 640px) {
          .payment-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
          }
          .btn-reverse {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
