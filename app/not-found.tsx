import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#F5F6FB",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ textAlign: "center", padding: "40px 24px" }}>
        <div
          style={{
            fontSize: "6rem",
            fontWeight: 800,
            color: "#6B21E8",
            letterSpacing: "-0.04em",
            lineHeight: 1,
          }}
        >
          404
        </div>

        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "#111827",
            margin: "16px 0 8px",
            letterSpacing: "-0.02em",
          }}
        >
          Página no encontrada
        </h1>

        <p
          style={{
            color: "#6b7280",
            fontSize: "0.95rem",
            marginBottom: "32px",
            lineHeight: 1.6,
          }}
        >
          La ruta que buscas no existe o fue movida.
        </p>

        <Link
          href="/dashboard"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "#6B21E8",
            color: "white",
            padding: "12px 28px",
            borderRadius: "10px",
            fontWeight: 600,
            fontSize: "0.925rem",
            textDecoration: "none",
            transition: "background 0.15s",
          }}
        >
          Ir al Dashboard
        </Link>
      </div>
    </div>
  );
}
