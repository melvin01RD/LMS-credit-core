'use client';

import { useState } from 'react';
import { useReportPDF } from '@/lib/hooks/useReportPDF';

type ReportType = 'recibo-pago' | 'estado-cuenta' | 'plan-pagos' | 'nota-pagare' | 'contrato';

interface ReportButtonProps {
  type: ReportType;
  entityId: string;
  label?: string;
  fileName?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  mode?: 'download' | 'preview';
}

const REPORT_LABELS: Record<ReportType, string> = {
  'recibo-pago': 'Recibo de Pago',
  'estado-cuenta': 'Estado de Cuenta',
  'plan-pagos': 'Plan de Pagos',
  'nota-pagare': 'Nota de Pagaré',
  'contrato': 'Contrato',
};

export default function ReportButton({
  type,
  entityId,
  label,
  fileName,
  variant = 'primary',
  size = 'md',
  mode = 'preview',
}: ReportButtonProps) {
  const [showError, setShowError] = useState(false);
  const { loading, error, downloadPDF, previewPDF } = useReportPDF({
    onError: () => setShowError(true),
  });

  const displayLabel = label || `PDF ${REPORT_LABELS[type]}`;

  const handleClick = async () => {
    setShowError(false);
    if (mode === 'download') {
      await downloadPDF(type, entityId, fileName);
    } else {
      await previewPDF(type, entityId);
    }
  };

  // Icono PDF SVG inline
  const PdfIcon = () => (
    <svg
      width={size === 'sm' ? 14 : 16}
      height={size === 'sm' ? 14 : 16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );

  // Spinner
  const Spinner = () => (
    <svg
      className="report-btn-spinner"
      width={size === 'sm' ? 14 : 16}
      height={size === 'sm' ? 14 : 16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" opacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75" />
    </svg>
  );

  return (
    <>
      <button
        onClick={handleClick}
        disabled={loading}
        className={`report-btn report-btn--${variant} report-btn--${size}`}
        title={`${mode === 'download' ? 'Descargar' : 'Ver'} ${REPORT_LABELS[type]}`}
      >
        {loading ? <Spinner /> : <PdfIcon />}
        {variant !== 'icon' && (
          <span>{loading ? 'Generando...' : displayLabel}</span>
        )}
      </button>

      {showError && error && (
        <div className="report-btn-error">
          <span>{error}</span>
          <button onClick={() => setShowError(false)}>✕</button>
        </div>
      )}

      <style jsx>{`
        .report-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-family: inherit;
          font-weight: 500;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .report-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        /* Sizes */
        .report-btn--sm {
          padding: 4px 10px;
          font-size: 12px;
        }
        .report-btn--md {
          padding: 8px 14px;
          font-size: 13px;
        }
        .report-btn--lg {
          padding: 10px 18px;
          font-size: 14px;
        }

        /* Variants */
        .report-btn--primary {
          background: #1a365d;
          color: #ffffff;
        }
        .report-btn--primary:hover:not(:disabled) {
          background: #2b6cb0;
        }

        .report-btn--secondary {
          background: #ebf8ff;
          color: #1a365d;
        }
        .report-btn--secondary:hover:not(:disabled) {
          background: #bee3f8;
        }

        .report-btn--outline {
          background: transparent;
          color: #1a365d;
          border: 1px solid #bee3f8;
        }
        .report-btn--outline:hover:not(:disabled) {
          background: #ebf8ff;
        }

        .report-btn--icon {
          padding: 6px;
          background: transparent;
          color: #4a5568;
          border-radius: 4px;
        }
        .report-btn--icon:hover:not(:disabled) {
          background: #ebf8ff;
          color: #1a365d;
        }

        /* Spinner animation */
        :global(.report-btn-spinner) {
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Error toast */
        .report-btn-error {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 6px;
          padding: 6px 10px;
          background: #fff5f5;
          border: 1px solid #fed7d7;
          border-radius: 4px;
          font-size: 12px;
          color: #c53030;
        }
        .report-btn-error button {
          background: none;
          border: none;
          color: #c53030;
          cursor: pointer;
          font-size: 14px;
          padding: 0;
          line-height: 1;
        }
      `}</style>
    </>
  );
}
