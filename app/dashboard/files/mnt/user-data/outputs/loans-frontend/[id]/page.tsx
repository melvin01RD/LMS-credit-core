"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface LoanDetail {
  id: string;
  principalAmount: string;
  annualInterestRate: string;
  paymentFrequency: string;
  termCount: number;
  installmentAmount: string;
  remainingCapital: string;
  status: string;
  nextDueDate: string | null;
  guarantees: string | null;
  createdAt: string;
  client: {
    id: string;
    firstName: string;
    lastName: string | null;
    documentId: string;
    phone: string;
    email: string | null;
  };
  payments: Payment[];
  createdBy: { id: string; firstName: string; lastName: string; email: string };
  updatedBy: { id: string; firstName: string; lastName: string; email: string } | null;
}

interface Payment {
  id: string;
  totalAmount: string;
  capitalApplied: string;
  interestApplied: string;
  lateFeeApplied: string;
  type: string;
  paymentDate: string;
  createdBy?: { id: string; firstName: string; lastName: string };
}

interface LoanSummary {
  loan: LoanDetail;
  summary: {
    principalAmount: number;
    remainingCapital: number;
    capitalPaid: number;
    interestPaid: number;
    lateFeesPaid: number;
    totalPaid: number;
    paymentCount: number;
    progressPercentage: number;
  };
}

interface AmortizationEntry {
  number: number;
  date: string;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  ACTIVE: { bg: "#d1fae5", color: "#059669", label: "Activo" },
  OVERDUE: { bg: "#fee2e2", color: "#dc2626", label: "En mora" },
  PAID: { bg: "#dbeafe", color: "#2563eb", label: "Pagado" },
  CANCELED: { bg: "#f3f4f6", color: "#6b7280", label: "Cancelado" },
};

const FREQUENCY_LABELS: Record<string, string> = {
  WEEKLY: "Semanal",
  BIWEEKLY: "Quincenal",
  MONTHLY: "Mensual",
};

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  REGULAR: "Regular",
  CAPITAL_PAYMENT: "Abono a capital",
  FULL_SETTLEMENT: "Liquidación total",
};

export default function LoanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loan, setLoan] = useState<LoanDetail | null>(null);
  const [summary, setSummary] = useState<LoanSummary["summary"] | null>(null);
  const [amortization, setAmortization] = useState<AmortizationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"summary" | "amortization" | "payments">("summary");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [canceling, setCanceling] = useState(false);

  const fmt = (n: number) => n.toLocaleString("es-DO", { minimumFractionDigits: 2 });

  useEffect(() => {
    async function fetchData() {
      try {
        const [loanRes, summaryRes] = await Promise.all([
          fetch(`/api/loans/${id}`),
          fetch(`/api/loans/${id}/summary`),
        ]);

        if (!loanRes.ok) {
          setError("Préstamo no encontrado");
          return;
        }

        const loanData = await loanRes.json();
        setLoan(loanData);

        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          setSummary(summaryData.summary);
        }
      } catch {
        setError("Error al cargar el préstamo");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [id]);

  // Cargar amortización solo cuando se abre esa pestaña
  useEffect(() => {
    if (activeTab !== "amortization" || amortization.length > 0) return;

    async function fetchAmortization() {
      try {
        const res = await fetch(`/api/loans/${id}/amortization`);
        if (res.ok) {
          const data = await res.json();
          setAmortization(data);
        }
      } catch {
        /* silenciar */
      }
    }

    fetchAmortization();
  }, [activeTab, id, amortization.length]);

  async function handleCancel() {
    setCanceling(true);
    try {
      const meRes = await fetch("/api/auth/me");
      const meData = await meRes.json();
      const userId = meData?.user?.userId;

      const res = await fetch(`/api/loans/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (res.ok) {
        // Recargar datos
        const loanRes = await fetch(`/api/loans/${id}`);
        if (loanRes.ok) setLoan(await loanRes.json());
        setShowCancelConfirm(false);
      } else {
        const data = await res.json();
        setError(data.error?.message ?? data.error ?? "Error al cancelar");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setCanceling(false);
    }
  }

  if (loading) {
    return <div style={{ padding: "40px", textAlign: "center", color: "#9ca3af" }}>Cargando...</div>;
  }

  if (error || !loan) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <p style={{ color: "#dc2626", marginBottom: "16px" }}>{error}</p>
        <button onClick={() => router.push("/dashboard/loans")} style={{ color: "#2563eb", background: "none", border: "none", cursor: "pointer" }}>
          Volver a préstamos
        </button>
      </div>
    );
  }

  const sc = STATUS_COLORS[loan.status] || STATUS_COLORS.CANCELED;
  const progress = summary?.progressPercentage ?? 0;
  const canCancel = loan.status === "ACTIVE" || loan.status === "OVERDUE";

  return (
    <div>
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <Link href="/dashboard/loans" className="breadcrumb-link">Préstamos</Link>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
        <span className="breadcrumb-current">Detalle</span>
      </div>

      {/* Header */}
      <div className="loan-header">
        <div className="loan-header-left">
          <div className="loan-amount">RD$ {fmt(Number(loan.principalAmount))}</div>
          <div className="loan-meta">
            <Link href={`/dashboard/clients/${loan.client.id}`} className="loan-client-link">
              {loan.client.firstName} {loan.client.lastName ?? ""}
            </Link>
            <span>•</span>
            <span>{FREQUENCY_LABELS[loan.paymentFrequency]}</span>
            <span>•</span>
            <span>{loan.termCount} cuotas</span>
            <span>•</span>
            <span>{Number(loan.annualInterestRate)}% anual</span>
          </div>
        </div>
        <div className="loan-header-right">
          <span className="status-badge" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
          {canCancel && (
            <button className="btn-danger-outline" onClick={() => setShowCancelConfirm(true)}>
              Cancelar Préstamo
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {summary && (
        <div className="progress-section">
          <div className="progress-header">
            <span className="progress-label">Progreso de pago</span>
            <span className="progress-pct">{progress.toFixed(1)}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
          <div className="progress-amounts">
            <span>RD$ {fmt(summary.capitalPaid)} pagado</span>
            <span>RD$ {fmt(summary.remainingCapital)} pendiente</span>
          </div>
        </div>
      )}

      {/* Stats cards */}
      {summary && (
        <div className="mini-stats">
          <div className="mini-stat">
            <span className="mini-stat-value">RD$ {fmt(summary.totalPaid)}</span>
            <span className="mini-stat-label">Total pagado</span>
          </div>
          <div className="mini-stat">
            <span className="mini-stat-value">{summary.paymentCount}</span>
            <span className="mini-stat-label">Pagos realizados</span>
          </div>
          <div className="mini-stat">
            <span className="mini-stat-value">RD$ {fmt(summary.interestPaid)}</span>
            <span className="mini-stat-label">Intereses pagados</span>
          </div>
          <div className="mini-stat">
            <span className="mini-stat-value">RD$ {fmt(Number(loan.installmentAmount))}</span>
            <span className="mini-stat-label">Cuota fija</span>
          </div>
          {loan.nextDueDate && (
            <div className="mini-stat">
              <span className="mini-stat-value">{new Date(loan.nextDueDate).toLocaleDateString("es-DO")}</span>
              <span className="mini-stat-label">Próximo vencimiento</span>
            </div>
          )}
          {summary.lateFeesPaid > 0 && (
            <div className="mini-stat">
              <span className="mini-stat-value" style={{ color: "#dc2626" }}>RD$ {fmt(summary.lateFeesPaid)}</span>
              <span className="mini-stat-label">Mora pagada</span>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${activeTab === "summary" ? "tab-active" : ""}`} onClick={() => setActiveTab("summary")}>
          Información
        </button>
        <button className={`tab ${activeTab === "payments" ? "tab-active" : ""}`} onClick={() => setActiveTab("payments")}>
          Pagos ({loan.payments.length})
        </button>
        <button className={`tab ${activeTab === "amortization" ? "tab-active" : ""}`} onClick={() => setActiveTab("amortization")}>
          Amortización
        </button>
      </div>

      {/* Tab content: Summary */}
      {activeTab === "summary" && (
        <div className="tab-content">
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Cliente</span>
              <span className="info-value">{loan.client.firstName} {loan.client.lastName ?? ""}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Documento</span>
              <span className="info-value" style={{ fontFamily: "monospace" }}>{loan.client.documentId}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Teléfono</span>
              <span className="info-value">{loan.client.phone}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Creado por</span>
              <span className="info-value">{loan.createdBy.firstName} {loan.createdBy.lastName}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Fecha de creación</span>
              <span className="info-value">{new Date(loan.createdAt).toLocaleDateString("es-DO")}</span>
            </div>
            {loan.guarantees && (
              <div className="info-item" style={{ gridColumn: "1 / -1" }}>
                <span className="info-label">Garantías</span>
                <span className="info-value">{loan.guarantees}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab content: Payments */}
      {activeTab === "payments" && (
        <div className="tab-content">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Monto</th>
                  <th>Capital</th>
                  <th>Interés</th>
                  <th>Mora</th>
                  <th>Tipo</th>
                  <th>Operador</th>
                </tr>
              </thead>
              <tbody>
                {loan.payments.length === 0 ? (
                  <tr><td colSpan={7} className="table-empty">No hay pagos registrados</td></tr>
                ) : (
                  loan.payments.map((p) => (
                    <tr key={p.id} className="table-row-static">
                      <td>{new Date(p.paymentDate).toLocaleDateString("es-DO")}</td>
                      <td className="td-bold">RD$ {fmt(Number(p.totalAmount))}</td>
                      <td>RD$ {fmt(Number(p.capitalApplied))}</td>
                      <td>RD$ {fmt(Number(p.interestApplied))}</td>
                      <td>{Number(p.lateFeeApplied) > 0 ? `RD$ ${fmt(Number(p.lateFeeApplied))}` : "—"}</td>
                      <td>
                        <span className="type-badge">{PAYMENT_TYPE_LABELS[p.type] ?? p.type}</span>
                      </td>
                      <td className="td-secondary">
                        {p.createdBy ? `${p.createdBy.firstName} ${p.createdBy.lastName}` : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab content: Amortization */}
      {activeTab === "amortization" && (
        <div className="tab-content">
          {amortization.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px", color: "#9ca3af" }}>Cargando tabla de amortización...</div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Fecha</th>
                    <th>Cuota</th>
                    <th>Capital</th>
                    <th>Interés</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {amortization.map((entry) => (
                    <tr key={entry.number} className="table-row-static">
                      <td className="td-secondary">{entry.number}</td>
                      <td>{new Date(entry.date).toLocaleDateString("es-DO")}</td>
                      <td className="td-bold">RD$ {fmt(entry.payment)}</td>
                      <td>RD$ {fmt(entry.principal)}</td>
                      <td>RD$ {fmt(entry.interest)}</td>
                      <td>RD$ {fmt(entry.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Cancel confirmation */}
      {showCancelConfirm && (
        <div className="modal-overlay" onClick={() => setShowCancelConfirm(false)}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h3 className="confirm-title">¿Cancelar este préstamo?</h3>
            <p className="confirm-text">
              Esta acción marcará el préstamo como CANCELADO. No se podrán registrar más pagos.
            </p>
            <div className="confirm-actions">
              <button className="btn-secondary" onClick={() => setShowCancelConfirm(false)}>Volver</button>
              <button className="btn-danger" onClick={handleCancel} disabled={canceling}>
                {canceling ? "Cancelando..." : "Sí, cancelar préstamo"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .breadcrumb {
          display: flex; align-items: center; gap: 8px;
          margin-bottom: 20px; font-size: 0.85rem;
        }
        .breadcrumb-link { color: #2563eb; text-decoration: none; }
        .breadcrumb-link:hover { text-decoration: underline; }
        .breadcrumb-current { color: #6b7280; }

        .loan-header {
          display: flex; justify-content: space-between;
          align-items: flex-start; margin-bottom: 24px;
        }
        .loan-header-left { flex: 1; }
        .loan-header-right { display: flex; align-items: center; gap: 12px; }
        .loan-amount {
          font-size: 1.8rem; font-weight: 700; color: #111827;
          letter-spacing: -0.03em;
        }
        .loan-meta {
          display: flex; gap: 8px; font-size: 0.85rem;
          color: #6b7280; margin-top: 4px; flex-wrap: wrap;
        }
        .loan-client-link {
          color: #2563eb; text-decoration: none; font-weight: 500;
        }
        .loan-client-link:hover { text-decoration: underline; }

        .status-badge {
          font-size: 0.8rem; font-weight: 600;
          padding: 4px 14px; border-radius: 20px;
        }
        .btn-danger-outline {
          background: none; border: 1px solid #fca5a5;
          border-radius: 8px; padding: 8px 16px;
          font-size: 0.825rem; font-weight: 500;
          color: #dc2626; cursor: pointer; transition: all 0.15s;
        }
        .btn-danger-outline:hover { background: #fef2f2; border-color: #dc2626; }

        /* Progress */
        .progress-section {
          background: white; border: 1px solid #e5e7eb;
          border-radius: 12px; padding: 16px 20px; margin-bottom: 16px;
        }
        .progress-header {
          display: flex; justify-content: space-between;
          margin-bottom: 8px;
        }
        .progress-label { font-size: 0.85rem; color: #6b7280; }
        .progress-pct { font-size: 0.9rem; font-weight: 700; color: #059669; }
        .progress-bar {
          height: 8px; background: #e5e7eb; border-radius: 4px;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%; background: #059669; border-radius: 4px;
          transition: width 0.5s ease;
        }
        .progress-amounts {
          display: flex; justify-content: space-between;
          margin-top: 8px; font-size: 0.8rem; color: #9ca3af;
        }

        /* Stats */
        .mini-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 12px; margin-bottom: 24px;
        }
        .mini-stat {
          background: white; border: 1px solid #e5e7eb;
          border-radius: 10px; padding: 14px 16px;
        }
        .mini-stat-value {
          display: block; font-size: 1.1rem; font-weight: 700; color: #111827;
        }
        .mini-stat-label {
          font-size: 0.75rem; color: #9ca3af; margin-top: 2px;
        }

        /* Tabs */
        .tabs {
          display: flex; gap: 0; border-bottom: 2px solid #e5e7eb;
          margin-bottom: 0;
        }
        .tab {
          background: none; border: none; border-bottom: 2px solid transparent;
          padding: 12px 20px; font-size: 0.875rem; font-weight: 500;
          color: #6b7280; cursor: pointer; margin-bottom: -2px;
          transition: all 0.15s;
        }
        .tab:hover { color: #111827; }
        .tab-active {
          color: #2563eb; border-bottom-color: #2563eb; font-weight: 600;
        }
        .tab-content {
          background: white; border: 1px solid #e5e7eb;
          border-top: none; border-radius: 0 0 12px 12px;
          padding: 20px;
        }

        /* Info grid */
        .info-grid {
          display: grid; grid-template-columns: 1fr 1fr 1fr;
          gap: 16px;
        }
        .info-item { display: flex; flex-direction: column; gap: 2px; }
        .info-label { font-size: 0.75rem; color: #9ca3af; font-weight: 500; text-transform: uppercase; letter-spacing: 0.04em; }
        .info-value { font-size: 0.9rem; color: #111827; font-weight: 500; }

        /* Table */
        .table-container {
          border-radius: 8px; overflow: hidden;
        }
        .table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
        .table thead { background: #f9fafb; }
        .table th {
          text-align: left; padding: 10px 14px; font-weight: 600; color: #6b7280;
          font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em;
          border-bottom: 1px solid #e5e7eb;
        }
        .table td {
          padding: 10px 14px; color: #374151; border-bottom: 1px solid #f3f4f6;
        }
        .table-row-static {}
        .table-empty { text-align: center; padding: 32px 14px !important; color: #9ca3af; }
        .td-bold { font-weight: 600; }
        .td-secondary { color: #9ca3af; }

        .type-badge {
          font-size: 0.7rem; font-weight: 600; padding: 3px 10px;
          border-radius: 12px; background: #f3f4f6; color: #6b7280;
        }

        /* Cancel modal */
        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.4);
          display: flex; align-items: center; justify-content: center;
          z-index: 50; padding: 16px;
        }
        .confirm-modal {
          background: white; border-radius: 14px; padding: 28px;
          max-width: 400px; width: 100%; text-align: center;
          box-shadow: 0 20px 60px rgba(0,0,0,0.15);
        }
        .confirm-icon { margin-bottom: 12px; }
        .confirm-title { font-size: 1.1rem; font-weight: 700; color: #111827; margin-bottom: 8px; }
        .confirm-text { font-size: 0.875rem; color: #6b7280; margin-bottom: 20px; }
        .confirm-actions { display: flex; gap: 10px; justify-content: center; }
        .btn-secondary {
          background: white; color: #374151; border: 1px solid #e5e7eb;
          border-radius: 8px; padding: 10px 20px; font-size: 0.875rem;
          font-weight: 500; cursor: pointer;
        }
        .btn-secondary:hover { background: #f9fafb; }
        .btn-danger {
          background: #dc2626; color: white; border: none;
          border-radius: 8px; padding: 10px 20px; font-size: 0.875rem;
          font-weight: 600; cursor: pointer;
        }
        .btn-danger:hover:not(:disabled) { background: #b91c1c; }
        .btn-danger:disabled { opacity: 0.6; cursor: not-allowed; }

        @media (max-width: 768px) {
          .loan-header { flex-direction: column; gap: 12px; }
          .info-grid { grid-template-columns: 1fr 1fr; }
          .mini-stats { grid-template-columns: 1fr 1fr; }
        }
      `}</style>
    </div>
  );
}
