"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { generateNumeroActo } from "@/lib/utils/pagare-notarial-utils";
import { NOTARIO_DEFAULT, ACREEDORES_DEFAULT, CIUDAD_DEFAULT } from "@/lib/config/pagare-notarial-config";

const ESTADO_CIVIL_OPTIONS = [
  { value: "soltero", label: "Soltero" },
  { value: "soltera", label: "Soltera" },
  { value: "casado", label: "Casado" },
  { value: "casada", label: "Casada" },
  { value: "divorciado", label: "Divorciado" },
  { value: "divorciada", label: "Divorciada" },
  { value: "viudo", label: "Viudo" },
  { value: "viuda", label: "Viuda" },
];

interface FormState {
  deudorNombre: string;
  deudorCedula: string;
  deudorEstadoCivil: string;
  deudorDomicilio: string;
  montoPrestado: string;
  totalAPagar: string;
  numeroCuotas: string;
  montoCuota: string;
  frecuenciaPago: string;
  porcentajeMora: string;
  diaLetras: string;
  mesLetras: string;
  anioLetras: string;
  garantias: string;
}

const INITIAL_FORM: FormState = {
  deudorNombre: "",
  deudorCedula: "",
  deudorEstadoCivil: "soltero",
  deudorDomicilio: "",
  montoPrestado: "",
  totalAPagar: "",
  numeroCuotas: "",
  montoCuota: "",
  frecuenciaPago: "",
  porcentajeMora: "10",
  diaLetras: "",
  mesLetras: "",
  anioLetras: "",
  garantias: "",
};

export default function PagareNotarialPage() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [numeroActo, setNumeroActo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNumeroActo(generateNumeroActo());
  }, []);

  // Auto-calcula montoCuota cuando cambian totalAPagar o numeroCuotas
  useEffect(() => {
    const total = parseFloat(form.totalAPagar);
    const cuotas = parseInt(form.numeroCuotas, 10);
    if (total > 0 && cuotas > 0) {
      setForm((prev) => ({
        ...prev,
        montoCuota: (total / cuotas).toFixed(2),
      }));
    }
  }, [form.totalAPagar, form.numeroCuotas]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload = {
        numeroActo,
        ciudad: CIUDAD_DEFAULT,
        diaLetras: form.diaLetras,
        mesLetras: form.mesLetras,
        anioLetras: form.anioLetras,
        notario: NOTARIO_DEFAULT,
        deudorNombre: form.deudorNombre.toUpperCase(),
        deudorCedula: form.deudorCedula,
        deudorEstadoCivil: form.deudorEstadoCivil,
        deudorDomicilio: form.deudorDomicilio,
        acreedores: ACREEDORES_DEFAULT,
        montoPrestado: parseFloat(form.montoPrestado),
        totalAPagar: parseFloat(form.totalAPagar),
        numeroCuotas: parseInt(form.numeroCuotas, 10),
        montoCuota: parseFloat(form.montoCuota),
        frecuenciaPago: form.frecuenciaPago,
        porcentajeMora: parseFloat(form.porcentajeMora),
        garantias: form.garantias || undefined,
      };

      const res = await fetch("/api/reports/pagare-notarial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message ?? "Error al generar el pagaré");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pagare-notarial-${numeroActo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <Link href="/dashboard/reportes" className="breadcrumb-link">
          Reportes
        </Link>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="breadcrumb-current">Pagaré Notarial</span>
      </div>

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Pagaré Notarial</h1>
          <p className="page-subtitle">
            Documento notarial con intervención de abogado — Art. 545 C.P.C.
          </p>
        </div>
        <div className="acto-badge">
          <span className="acto-label">Acto No.</span>
          <span className="acto-value">{numeroActo || "—"}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* ------------------------------------------------------------------ */}
        {/* SECCIÓN: Datos del Acto                                            */}
        {/* ------------------------------------------------------------------ */}
        <div className="card">
          <div className="section-header">
            <span className="section-number">1</span>
            <h2 className="section-title">Fecha del Acto</h2>
          </div>
          <div className="form-grid form-grid--3">
            <div className="field">
              <label className="field-label">Día en letras *</label>
              <input
                name="diaLetras"
                value={form.diaLetras}
                onChange={handleChange}
                placeholder="Ej: Veinticuatro (24)"
                className="field-input"
                required
              />
            </div>
            <div className="field">
              <label className="field-label">Mes en letras *</label>
              <input
                name="mesLetras"
                value={form.mesLetras}
                onChange={handleChange}
                placeholder="Ej: Diciembre"
                className="field-input"
                required
              />
            </div>
            <div className="field">
              <label className="field-label">Año en letras *</label>
              <input
                name="anioLetras"
                value={form.anioLetras}
                onChange={handleChange}
                placeholder="Ej: Dos Mil Veinticinco (2025)"
                className="field-input"
                required
              />
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* SECCIÓN: Datos del Deudor                                          */}
        {/* ------------------------------------------------------------------ */}
        <div className="card">
          <div className="section-header">
            <span className="section-number">2</span>
            <h2 className="section-title">Datos del Deudor</h2>
          </div>
          <div className="form-grid form-grid--2">
            <div className="field">
              <label className="field-label">Nombre completo *</label>
              <input
                name="deudorNombre"
                value={form.deudorNombre}
                onChange={handleChange}
                placeholder="Ej: VALENTINA ROSARIO PEÑA"
                className="field-input"
                maxLength={60}
                required
              />
            </div>
            <div className="field">
              <label className="field-label">Cédula *</label>
              <input
                name="deudorCedula"
                value={form.deudorCedula}
                onChange={handleChange}
                placeholder="Ej: 001-1610083-5"
                className="field-input"
                required
              />
            </div>
            <div className="field">
              <label className="field-label">Estado civil *</label>
              <select
                name="deudorEstadoCivil"
                value={form.deudorEstadoCivil}
                onChange={handleChange}
                className="field-input"
                required
              >
                {ESTADO_CIVIL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field-label">Domicilio *</label>
              <input
                name="deudorDomicilio"
                value={form.deudorDomicilio}
                onChange={handleChange}
                placeholder="Dirección completa"
                className="field-input"
                required
              />
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* SECCIÓN: Condiciones del Préstamo                                  */}
        {/* ------------------------------------------------------------------ */}
        <div className="card">
          <div className="section-header">
            <span className="section-number">3</span>
            <h2 className="section-title">Condiciones del Préstamo</h2>
          </div>
          <div className="form-grid form-grid--2">
            <div className="field">
              <label className="field-label">Capital prestado (RD$) *</label>
              <input
                type="number"
                name="montoPrestado"
                value={form.montoPrestado}
                onChange={handleChange}
                placeholder="Ej: 150000"
                className="field-input"
                min="1"
                step="0.01"
                required
              />
            </div>
            <div className="field">
              <label className="field-label">Total a pagar (RD$) *</label>
              <input
                type="number"
                name="totalAPagar"
                value={form.totalAPagar}
                onChange={handleChange}
                placeholder="Ej: 84000"
                className="field-input"
                min="1"
                step="0.01"
                required
              />
            </div>
            <div className="field">
              <label className="field-label">Número de cuotas *</label>
              <input
                type="number"
                name="numeroCuotas"
                value={form.numeroCuotas}
                onChange={handleChange}
                placeholder="Ej: 8"
                className="field-input"
                min="1"
                step="1"
                required
              />
            </div>
            <div className="field">
              <label className="field-label">Monto por cuota (RD$)</label>
              <input
                type="number"
                name="montoCuota"
                value={form.montoCuota}
                onChange={handleChange}
                placeholder="Auto-calculado"
                className="field-input field-input--auto"
                step="0.01"
                readOnly
              />
              <span className="field-hint">Calculado automáticamente</span>
            </div>
            <div className="field">
              <label className="field-label">Frecuencia de pago *</label>
              <input
                name="frecuenciaPago"
                value={form.frecuenciaPago}
                onChange={handleChange}
                placeholder="Ej: todos los viernes"
                className="field-input"
                required
              />
            </div>
            <div className="field">
              <label className="field-label">% de mora *</label>
              <input
                type="number"
                name="porcentajeMora"
                value={form.porcentajeMora}
                onChange={handleChange}
                className="field-input"
                min="0"
                max="100"
                step="0.01"
                required
              />
            </div>
          </div>
          <div className="field field--full">
            <label className="field-label">Garantías adicionales (opcional)</label>
            <textarea
              name="garantias"
              value={form.garantias}
              onChange={handleChange}
              placeholder="Descripción de garantías específicas..."
              className="field-textarea"
              rows={3}
            />
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* SECCIÓN: Notario y Acreedores (solo lectura)                       */}
        {/* ------------------------------------------------------------------ */}
        <div className="card card--readonly">
          <div className="section-header">
            <span className="section-number section-number--gray">i</span>
            <h2 className="section-title">Notario y Acreedores</h2>
            <span className="readonly-badge">Solo lectura</span>
          </div>

          <div className="readonly-block">
            <p className="readonly-block-title">Notario Público</p>
            <div className="readonly-grid">
              <div>
                <span className="readonly-label">Nombre</span>
                <span className="readonly-value">{NOTARIO_DEFAULT.nombre}</span>
              </div>
              <div>
                <span className="readonly-label">Cédula</span>
                <span className="readonly-value">{NOTARIO_DEFAULT.cedula}</span>
              </div>
              <div>
                <span className="readonly-label">Matrícula</span>
                <span className="readonly-value">{NOTARIO_DEFAULT.matricula}</span>
              </div>
              <div className="readonly-grid-full">
                <span className="readonly-label">Estudio</span>
                <span className="readonly-value">{NOTARIO_DEFAULT.estudio}</span>
              </div>
            </div>
          </div>

          {ACREEDORES_DEFAULT.map((a, idx) => (
            <div key={idx} className="readonly-block">
              <p className="readonly-block-title">Acreedor {idx + 1}</p>
              <div className="readonly-grid">
                <div>
                  <span className="readonly-label">Nombre</span>
                  <span className="readonly-value">{a.nombre}</span>
                </div>
                <div>
                  <span className="readonly-label">Cédula</span>
                  <span className="readonly-value">{a.cedula}</span>
                </div>
                <div>
                  <span className="readonly-label">Estado civil</span>
                  <span className="readonly-value">{a.estadoCivil}</span>
                </div>
                <div className="readonly-grid-full">
                  <span className="readonly-label">Domicilio</span>
                  <span className="readonly-value">{a.domicilio}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* ERROR                                                               */}
        {/* ------------------------------------------------------------------ */}
        {error && (
          <div className="error-banner">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* BOTÓN                                                               */}
        {/* ------------------------------------------------------------------ */}
        <div className="submit-row">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner" />
                Generando...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                Generar Pagaré Notarial
              </>
            )}
          </button>
        </div>
      </form>

      <style jsx>{`
        .breadcrumb { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; font-size: 0.85rem; }
        .breadcrumb-current { color: #6b7280; }

        .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
        .page-title { font-size: 1.5rem; font-weight: 700; color: #111827; letter-spacing: -0.02em; }
        .page-subtitle { font-size: 0.85rem; color: #6b7280; margin-top: 2px; }

        .acto-badge { text-align: right; }
        .acto-label { display: block; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; }
        .acto-value { font-size: 1.1rem; font-weight: 700; color: #1a365d; font-family: monospace; }

        .card { background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-bottom: 16px; }
        .card--readonly { background: #fafafa; border-color: #e5e7eb; }

        .section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
        .section-number { width: 28px; height: 28px; border-radius: 50%; background: #2563eb; color: white; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700; flex-shrink: 0; }
        .section-number--gray { background: #e5e7eb; color: #6b7280; font-size: 0.75rem; }
        .section-title { font-size: 1rem; font-weight: 700; color: #111827; }
        .readonly-badge { margin-left: auto; font-size: 0.7rem; font-weight: 600; padding: 2px 8px; border-radius: 10px; background: #f3f4f6; color: #6b7280; }

        .form-grid { display: grid; gap: 14px; }
        .form-grid--2 { grid-template-columns: 1fr 1fr; }
        .form-grid--3 { grid-template-columns: 1fr 1fr 1fr; }

        .field { display: flex; flex-direction: column; gap: 4px; }
        .field--full { margin-top: 14px; }
        .field-label { font-size: 0.75rem; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.04em; }
        .field-input { height: 40px; padding: 0 12px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; color: #111827; outline: none; background: white; transition: border-color 0.15s; }
        .field-input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); }
        .field-input--auto { background: #f9fafb; color: #6b7280; cursor: default; }
        .field-hint { font-size: 0.7rem; color: #9ca3af; }
        .field-textarea { padding: 10px 12px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; color: #111827; outline: none; background: white; resize: vertical; font-family: inherit; transition: border-color 0.15s; }
        .field-textarea:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); }

        .readonly-block { margin-bottom: 16px; padding: 14px; background: white; border: 1px solid #e5e7eb; border-radius: 10px; }
        .readonly-block:last-child { margin-bottom: 0; }
        .readonly-block-title { font-size: 0.75rem; font-weight: 700; color: #1a365d; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 10px; }
        .readonly-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .readonly-grid-full { grid-column: 1 / -1; }
        .readonly-label { display: block; font-size: 0.7rem; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 2px; }
        .readonly-value { display: block; font-size: 0.85rem; color: #374151; }

        .error-banner { display: flex; align-items: center; gap: 8px; padding: 12px 16px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; color: #dc2626; font-size: 0.875rem; margin-bottom: 16px; }

        .submit-row { display: flex; justify-content: flex-end; padding-bottom: 32px; }
        .btn-primary { display: flex; align-items: center; gap: 8px; padding: 0 24px; height: 44px; background: #1a365d; color: white; border: none; border-radius: 10px; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: background 0.15s; }
        .btn-primary:hover:not(:disabled) { background: #2b6cb0; }
        .btn-primary:disabled { opacity: 0.7; cursor: not-allowed; }

        .spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 640px) {
          .page-header { flex-direction: column; gap: 12px; }
          .form-grid--2 { grid-template-columns: 1fr; }
          .form-grid--3 { grid-template-columns: 1fr; }
          .readonly-grid { grid-template-columns: 1fr; }
        }
      `}</style>
      <style jsx global>{`
        .breadcrumb-link { color: #2563eb; text-decoration: none; }
        .breadcrumb-link:hover { text-decoration: underline; }
      `}</style>
    </div>
  );
}
