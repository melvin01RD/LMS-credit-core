"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

// ============================================
// INTERFACES
// ============================================

interface PaymentDetail {
  id: string;
  loanId: string;
  paymentDate: string;
  totalAmount: string;
  capitalApplied: string;
  interestApplied: string;
  lateFeeApplied: string;
  type: string;
  createdAt: string;
  loan: {
    id: string;
    principalAmount: string;
    annualInterestRate: string;
    paymentFrequency: string;
    remainingCapital: string;
    status: string;
    client: {
      id: string;
      firstName: string;
      lastName: string | null;
      documentId: string;
      phone: string;
      email: string | null;
      address: string | null;
    };
  };
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

// ============================================
// CONSTANTS
// ============================================

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  REGULAR: { bg: "#dbeafe", color: "#2563eb" },
  CAPITAL_PAYMENT: { bg: "#fef3c7", color: "#d97706" },
  FULL_SETTLEMENT: { bg: "#d1fae5", color: "#059669" },
};

const TYPE_LABELS: Record<string, string> = {
  REGULAR: "Regular",
  CAPITAL_PAYMENT: "Abono a Capital",
  FULL_SETTLEMENT: "Liquidación Total",
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  ACTIVE: { bg: "#d1fae5", color: "#059669" },
  OVERDUE: { bg: "#fee2e2", color: "#dc2626" },
  PAID: { bg: "#dbeafe", color: "#2563eb" },
  CANCELED: { bg: "#f3f4f6", color: "#6b7280" },
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Activo",
  OVERDUE: "En mora",
  PAID: "Pagado",
  CANCELED: "Cancelado",
};

const FREQUENCY_LABELS: Record<string, string> = {
  WEEKLY: "Semanal",
  BIWEEKLY: "Quincenal",
  MONTHLY: "Mensual",
};

// ============================================
// PAGE
// ============================================

export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showReverseModal, setShowReverseModal] = useState(false);

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

  const fmt = (n: number) => n.toLocaleString("es-DO", { minimumFractionDigits: 2 });
  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("es-DO", { year: "numeric", month: "long", day: "numeric" });

  const totalAmount = Number(payment.totalAmount);
  const capitalApplied = Number(payment.capitalApplied);
  const interestApplied = Number(payment.interestApplied);
  const lateFeeApplied = Number(payment.lateFeeApplied);
  const isReversal = totalAmount < 0;
  const absTotal = Math.abs(totalAmount);

  const tc = TYPE_COLORS[payment.type] || TYPE_COLORS.REGULAR;
  const loanSc = STATUS_COLORS[payment.loan.status] || STATUS_COLORS.CANCELED;
  const clientName = `${payment.loan.client.firstName} ${payment.loan.client.lastName ?? ""}`.trim();

  // Calculate proportions for the breakdown bar
  const absCap = Math.abs(capitalApplied);
  const absInt = Math.abs(interestApplied);
  const absFee = Math.abs(lateFeeApplied);
  const capPct = absTotal > 0 ? (absCap / absTotal) * 100 : 0;
  const intPct = absTotal > 0 ? (absInt / absTotal) * 100 : 0;
  const feePct = absTotal > 0 ? (absFee / absTotal) * 100 : 0;

  const canReverse = !isReversal;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <Link href="/dashboard/payments" className="breadcrumb-link">Pagos</Link>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="breadcrumb-current">Detalle del pago</span>
      </div>

      {/* Payment header */}
      <div className="payment-header">
        <div className="payment-header-left">
          <h1 className={`payment-amount ${isReversal ? "negative" : ""}`}>
            {isReversal ? "−" : ""}RD$ {fmt(absTotal)}
          </h1>
          <div className="payment-meta">
            <span>{fmtDate(payment.paymentDate)}</span>
            <span className="meta-sep">•</span>
            <span className="type-badge" style={{ background: tc.bg, color: tc.color }}>
              {isReversal ? "Reversión" : (TYPE_LABELS[payment.type] ?? payment.type)}
            </span>
          </div>
        </div>
        {canReverse && (
          <button className="btn-danger" onClick={() => setShowReverseModal(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            Reversar Pago
          </button>
        )}
      </div>

      {/* Breakdown card */}
      <div className="card">
        <h2 className="card-title">Desglose del pago</h2>

        {/* Visual bar */}
        <div className="breakdown-bar">
          {capPct > 0 && (
            <div className="bar-segment bar-capital" style={{ width: `${capPct}%` }} title="Capital" />
          )}
          {intPct > 0 && (
            <div className="bar-segment bar-interest" style={{ width: `${intPct}%` }} title="Interés" />
          )}
          {feePct > 0 && (
            <div className="bar-segment bar-fee" style={{ width: `${feePct}%` }} title="Mora" />
          )}
        </div>

        <div className="breakdown-items">
          <div className="breakdown-item">
            <div className="breakdown-item-left">
              <span className="breakdown-dot" style={{ background: "#2563eb" }} />
              <span className="breakdown-label">Capital aplicado</span>
            </div>
            <span className="breakdown-value">RD$ {fmt(absCap)}</span>
          </div>
          <div className="breakdown-item">
            <div className="breakdown-item-left">
              <span className="breakdown-dot" style={{ background: "#f59e0b" }} />
              <span className="breakdown-label">Interés aplicado</span>
            </div>
            <span className="breakdown-value">RD$ {fmt(absInt)}</span>
          </div>
          <div className="breakdown-item">
            <div className="breakdown-item-left">
              <span className="breakdown-dot" style={{ background: "#ef4444" }} />
              <span className="breakdown-label">Mora aplicada</span>
            </div>
            <span className="breakdown-value">
              {absFee > 0 ? `RD$ ${fmt(absFee)}` : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Info grid */}
      <div className="info-grid">
        {/* Loan info */}
        <div className="card">
          <h2 className="card-title">Préstamo</h2>
          <div className="info-rows">
            <div className="info-row">
              <span className="info-label">Cliente</span>
              <span className="info-value">
                <Link href={`/dashboard/clients/${payment.loan.client.id}`} style={{ color: "#2563eb", textDecoration: "none" }}>
                  {clientName}
                </Link>
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">Documento</span>
              <span className="info-value" style={{ fontFamily: "monospace" }}>
                {payment.loan.client.documentId}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">Monto del préstamo</span>
              <span className="info-value">RD$ {fmt(Number(payment.loan.principalAmount))}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Capital pendiente</span>
              <span className="info-value">RD$ {fmt(Number(payment.loan.remainingCapital))}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Frecuencia</span>
              <span className="info-value">
                {FREQUENCY_LABELS[payment.loan.paymentFrequency] ?? payment.loan.paymentFrequency}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">Estado</span>
              <span className="info-value">
                <span className="status-badge" style={{ background: loanSc.bg, color: loanSc.color }}>
                  {STATUS_LABELS[payment.loan.status] ?? payment.loan.status}
                </span>
              </span>
            </div>
          </div>
          <Link
            href={`/dashboard/loans/${payment.loan.id}`}
            className="card-link"
          >
            Ver préstamo →
          </Link>
        </div>

        {/* Registration info */}
        <div className="card">
          <h2 className="card-title">Registro</h2>
          <div className="info-rows">
            <div className="info-row">
              <span className="info-label">Registrado por</span>
              <span className="info-value">
                {payment.createdBy.firstName} {payment.createdBy.lastName}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">Email</span>
              <span className="info-value">{payment.createdBy.email}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Fecha de pago</span>
              <span className="info-value">{fmtDate(payment.paymentDate)}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Fecha de registro</span>
              <span className="info-value">{fmtDate(payment.createdAt)}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Tipo de pago</span>
              <span className="info-value">
                {TYPE_LABELS[payment.type] ?? payment.type}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">ID del pago</span>
              <span className="info-value" style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
                {payment.id}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Reverse modal */}
      {showReverseModal && (
        <ReversePaymentModal
          paymentId={payment.id}
          amount={absTotal}
          onClose={() => setShowReverseModal(false)}
          onReversed={() => {
            setShowReverseModal(false);
            router.push("/dashboard/payments");
          }}
        />
      )}

      <style jsx>{`
        .breadcrumb {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 20px;
          font-size: 0.85rem;
        }
        .breadcrumb-current { color: #6b7280; }

        .payment-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
          gap: 16px;
          flex-wrap: wrap;
        }
        .payment-header-left {
          flex: 1;
          min-width: 0;
        }
        .payment-amount {
          font-size: 1.8rem;
          font-weight: 700;
          color: #111827;
          letter-spacing: -0.02em;
        }
        .payment-amount.negative {
          color: #dc2626;
        }
        .payment-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.85rem;
          color: #6b7280;
          margin-top: 4px;
        }
        .meta-sep { color: #d1d5db; }

        .type-badge {
          font-size: 0.75rem;
          font-weight: 600;
          padding: 3px 10px;
          border-radius: 12px;
          white-space: nowrap;
        }

        .btn-danger {
          display: flex;
          align-items: center;
          gap: 8px;
          background: white;
          color: #dc2626;
          border: 1px solid #fecaca;
          border-radius: 8px;
          padding: 10px 18px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          flex-shrink: 0;
        }
        .btn-danger:hover {
          background: #fef2f2;
          border-color: #dc2626;
        }

        .card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 16px;
        }
        .card-title {
          font-size: 0.95rem;
          font-weight: 700;
          color: #111827;
          margin-bottom: 16px;
        }

        /* Breakdown bar */
        .breakdown-bar {
          display: flex;
          height: 10px;
          border-radius: 5px;
          overflow: hidden;
          background: #f3f4f6;
          margin-bottom: 16px;
        }
        .bar-segment {
          height: 100%;
          transition: width 0.4s ease;
        }
        .bar-capital { background: #2563eb; }
        .bar-interest { background: #f59e0b; }
        .bar-fee { background: #ef4444; }

        .breakdown-items {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .breakdown-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .breakdown-item-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .breakdown-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .breakdown-label {
          font-size: 0.85rem;
          color: #6b7280;
        }
        .breakdown-value {
          font-size: 0.85rem;
          font-weight: 600;
          color: #111827;
        }

        /* Info grid */
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .info-rows {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .info-label {
          font-size: 0.825rem;
          color: #6b7280;
        }
        .info-value {
          font-size: 0.825rem;
          font-weight: 600;
          color: #111827;
          text-align: right;
        }

        .status-badge {
          font-size: 0.7rem;
          font-weight: 600;
          padding: 3px 10px;
          border-radius: 12px;
        }

        @media (max-width: 700px) {
          .info-grid { grid-template-columns: 1fr; }
          .payment-amount { font-size: 1.4rem; }
        }
      `}</style>

      <style jsx global>{`
        .breadcrumb-link {
          color: #2563eb;
          text-decoration: none;
        }
        .breadcrumb-link:hover { text-decoration: underline; }
        .card-link {
          display: inline-block;
          margin-top: 14px;
          font-size: 0.825rem;
          font-weight: 600;
          color: #2563eb;
          text-decoration: none;
        }
        .card-link:hover { text-decoration: underline; }
      `}</style>
    </div>
  );
}

// ============================================
// MODAL: Reverse Payment
// ============================================

function ReversePaymentModal({
  paymentId,
  amount,
  onClose,
  onReversed,
}: {
  paymentId: string;
  amount: number;
  onClose: () => void;
  onReversed: () => void;
}) {
  const [reason, setReason] = useState("");
  const [reversing, setReversing] = useState(false);
  const [error, setError] = useState("");

  const fmt = (n: number) => n.toLocaleString("es-DO", { minimumFractionDigits: 2 });

  async function handleReverse() {
    setReversing(true);
    setError("");

    try {
      // Get current user
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) {
        setError("Sesión expirada. Recarga la página.");
        return;
      }
      const meData = await meRes.json();

      const res = await fetch(`/api/payments/${paymentId}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reversedById: meData.user.userId,
          reason: reason || "Sin razón especificada",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message ?? data.error ?? "Error al reversar el pago");
        return;
      }

      onReversed();
    } catch {
      setError("Error de conexión");
    } finally {
      setReversing(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Reversar Pago</h2>
          <button className="modal-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal-warning">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>
            <p>Se creará un pago negativo por <strong>RD$ {fmt(amount)}</strong> que revertirá el capital al saldo anterior del préstamo.</p>
            <p style={{ marginTop: "6px" }}>Esta acción no se puede deshacer.</p>
          </div>
        </div>

        {error && <div className="modal-error">{error}</div>}

        <div className="form-group">
          <label className="form-label">Razón de la reversión</label>
          <textarea
            className="form-textarea"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ingrese la razón de la reversión (opcional)..."
            rows={3}
          />
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn-confirm-danger"
            onClick={handleReverse}
            disabled={reversing}
          >
            {reversing ? "Reversando..." : "Confirmar Reversión"}
          </button>
        </div>

        <style jsx>{`
          .modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 50;
            padding: 16px;
          }
          .modal {
            background: white;
            border-radius: 14px;
            width: 100%;
            max-width: 480px;
            padding: 24px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.15);
          }
          .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
          }
          .modal-title {
            font-size: 1.1rem;
            font-weight: 700;
            color: #111827;
          }
          .modal-close {
            background: none;
            border: none;
            color: #9ca3af;
            cursor: pointer;
            padding: 4px;
          }
          .modal-close:hover { color: #374151; }

          .modal-warning {
            display: flex;
            gap: 12px;
            align-items: flex-start;
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 8px;
            padding: 14px;
            margin-bottom: 16px;
          }
          .modal-warning p {
            font-size: 0.85rem;
            color: #991b1b;
            line-height: 1.5;
            margin: 0;
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

          .form-group {
            margin-bottom: 16px;
          }
          .form-label {
            display: block;
            font-size: 0.8rem;
            font-weight: 600;
            color: #374151;
            margin-bottom: 4px;
          }
          .form-textarea {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            font-size: 0.875rem;
            outline: none;
            resize: vertical;
            font-family: inherit;
            transition: border-color 0.15s;
          }
          .form-textarea:focus {
            border-color: #2563eb;
            box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
          }

          .modal-actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            padding-top: 8px;
          }
          .btn-secondary {
            background: white;
            color: #374151;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 10px 20px;
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
          }
          .btn-secondary:hover { background: #f9fafb; }
          .btn-confirm-danger {
            background: #dc2626;
            color: white;
            border: none;
            border-radius: 8px;
            padding: 10px 20px;
            font-size: 0.875rem;
            font-weight: 600;
            cursor: pointer;
          }
          .btn-confirm-danger:hover:not(:disabled) { background: #b91c1c; }
          .btn-confirm-danger:disabled { opacity: 0.6; cursor: not-allowed; }
        `}</style>
      </div>
    </div>
  );
}
