"use client";

import { useRouter } from "next/navigation";

export default function UnauthorizedPage() {
  const router = useRouter();

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0f1035",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "system-ui, -apple-system, sans-serif",
      padding: "24px",
    }}>
      <div style={{
        textAlign: "center",
        maxWidth: "420px",
        width: "100%",
      }}>
        {/* Icono */}
        <div style={{
          width: "72px",
          height: "72px",
          borderRadius: "20px",
          background: "rgba(107, 33, 232, 0.15)",
          border: "1px solid rgba(107, 33, 232, 0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 24px",
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#6B21E8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        {/* Código */}
        <p style={{
          fontSize: "0.8rem",
          fontWeight: 700,
          letterSpacing: "0.1em",
          color: "#6B21E8",
          textTransform: "uppercase",
          marginBottom: "12px",
        }}>
          403 — Acceso Denegado
        </p>

        {/* Título */}
        <h1 style={{
          fontSize: "1.75rem",
          fontWeight: 700,
          color: "#ffffff",
          marginBottom: "12px",
          letterSpacing: "-0.02em",
          lineHeight: 1.2,
        }}>
          No tienes permiso para acceder a esta página
        </h1>

        {/* Descripción */}
        <p style={{
          fontSize: "0.9rem",
          color: "rgba(255,255,255,0.55)",
          lineHeight: 1.6,
          marginBottom: "32px",
        }}>
          Esta sección requiere permisos de administrador. Si crees que esto es un error, contacta al administrador del sistema.
        </p>

        {/* Botón */}
        <button
          onClick={() => router.replace("/dashboard")}
          style={{
            background: "#6B21E8",
            color: "#ffffff",
            border: "none",
            borderRadius: "10px",
            padding: "12px 28px",
            fontSize: "0.9rem",
            fontWeight: 600,
            cursor: "pointer",
            transition: "background 0.15s",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = "#5b17c8")}
          onMouseOut={(e) => (e.currentTarget.style.background = "#6B21E8")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Volver al Dashboard
        </button>
      </div>
    </div>
  );
}
