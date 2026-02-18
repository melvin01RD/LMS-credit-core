"use client";

import { useRouter } from "next/navigation";

// ============================================
// CARTERA VIGENTE — descarga directa
// ============================================

function CarteraVigenteCard() {
  function handleDownload(type: 'cartera-vigente' | 'cartera-vigente-excel') {
    window.open(`/api/reports/${type}`, '_blank');
  }

  return (
    <div className="report-card report-card--available report-card--dual">
      <div className="report-card-header">
        <div className="report-card-icon icon-active">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8M12 17v4" />
            <path d="M6 8h4M6 11h6M6 14h2" />
          </svg>
        </div>
        <span className="badge-available">Disponible</span>
      </div>

      <h3 className="report-card-title">Cartera Vigente</h3>
      <p className="report-card-desc">
        Préstamos activos, capital en la calle y estado de recuperación
      </p>

      <div className="cartera-actions">
        <button
          className="btn-pdf"
          onClick={() => handleDownload('cartera-vigente')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          Descargar PDF
        </button>
        <button
          className="btn-excel"
          onClick={() => handleDownload('cartera-vigente-excel')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="8" y1="13" x2="16" y2="13" />
            <line x1="8" y1="17" x2="16" y2="17" />
          </svg>
          Descargar Excel
        </button>
      </div>
    </div>
  );
}

// ============================================
// REPORT CARDS DATA
// ============================================

interface ReportCard {
  id: string;
  title: string;
  description: string;
  available: boolean;
  href: string;
  icon: React.ReactNode;
}

const REPORTS: ReportCard[] = [
  {
    id: "recibo-pago",
    title: "Recibo de Pago",
    description: "Comprobante de pago para entregar al cliente",
    available: true,
    href: "/dashboard/reportes/recibo-pago",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    id: "estado-cuenta",
    title: "Estado de Cuenta",
    description: "Historial completo de pagos de un préstamo",
    available: true,
    href: "/dashboard/reportes/estado-cuenta",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
  },
  {
    id: "plan-pagos",
    title: "Plan de Pagos",
    description: "Tabla de amortización del préstamo",
    available: true,
    href: "/dashboard/reportes/plan-pagos",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    id: "nota-pagare",
    title: "Nota de Pagaré",
    description: "Documento legal de compromiso de pago",
    available: true,
    href: "/dashboard/reportes/nota-pagare",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    id: "contrato",
    title: "Contrato de Préstamo",
    description: "Contrato completo con cláusulas legales",
    available: true,
    href: "/dashboard/reportes/contrato",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
      </svg>
    ),
  },
];

// ============================================
// PAGE
// ============================================

export default function ReportesPage() {
  const router = useRouter();

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Reportes</h1>
          <p className="page-subtitle">
            Genera documentos PDF para tus clientes y préstamos
          </p>
        </div>
      </div>

      {/* Report Cards Grid */}
      <div className="reports-grid">
        <CarteraVigenteCard />
        {REPORTS.map((report) => (
          <div
            key={report.id}
            className={`report-card ${report.available ? "report-card--available" : "report-card--disabled"}`}
            onClick={() => report.available && router.push(report.href)}
          >
            <div className="report-card-header">
              <div className={`report-card-icon ${report.available ? "icon-active" : "icon-disabled"}`}>
                {report.icon}
              </div>
              {report.available ? (
                <span className="badge-available">Disponible</span>
              ) : (
                <span className="badge-soon">Próximamente</span>
              )}
            </div>

            <h3 className="report-card-title">{report.title}</h3>
            <p className="report-card-desc">{report.description}</p>

            {report.available && (
              <div className="report-card-action">
                <span>Generar reporte</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      <style jsx>{`
        .page-header {
          margin-bottom: 24px;
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

        .reports-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }

        .report-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 20px;
          transition: all 0.2s ease;
        }
        .report-card--available {
          cursor: pointer;
        }
        .report-card--available:hover {
          border-color: #2563eb;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.1);
          transform: translateY(-2px);
        }
        .report-card--disabled {
          opacity: 0.6;
        }

        .report-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 14px;
        }

        .report-card-icon {
          width: 48px;
          height: 48px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .icon-active {
          background: #eff6ff;
          color: #2563eb;
        }
        .icon-disabled {
          background: #f3f4f6;
          color: #9ca3af;
        }

        .badge-available {
          font-size: 0.7rem;
          font-weight: 600;
          padding: 3px 10px;
          border-radius: 12px;
          background: #d1fae5;
          color: #059669;
        }
        .badge-soon {
          font-size: 0.7rem;
          font-weight: 600;
          padding: 3px 10px;
          border-radius: 12px;
          background: #fef3c7;
          color: #d97706;
        }

        .report-card-title {
          font-size: 1rem;
          font-weight: 700;
          color: #111827;
          margin-bottom: 4px;
        }
        .report-card-desc {
          font-size: 0.825rem;
          color: #6b7280;
          line-height: 1.5;
          margin-bottom: 0;
        }

        .report-card-action {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid #f3f4f6;
          font-size: 0.825rem;
          font-weight: 600;
          color: #2563eb;
        }

        .report-card--dual {
          cursor: default;
        }
        .report-card--dual:hover {
          transform: none;
        }

        .cartera-actions {
          display: flex;
          gap: 8px;
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid #f3f4f6;
        }

        .btn-pdf,
        .btn-excel {
          display: flex;
          align-items: center;
          gap: 5px;
          flex: 1;
          justify-content: center;
          padding: 7px 10px;
          border-radius: 8px;
          border: none;
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.15s ease;
        }
        .btn-pdf:hover,
        .btn-excel:hover {
          opacity: 0.85;
        }

        .btn-pdf {
          background: #eff6ff;
          color: #2563eb;
        }

        .btn-excel {
          background: #f0fdf4;
          color: #16a34a;
        }

        @media (max-width: 640px) {
          .reports-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
