"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface User {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (!res.ok) {
          router.push("/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.user) setUser(data.user);
        setLoading(false);
      })
      .catch(() => {
        router.push("/login");
      });
  }, [router]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "sans-serif", color: "#6b7280" }}>
        Cargando...
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "var(--font-inter), sans-serif" }}>
      {/* Header */}
      <header style={{
        background: "white",
        borderBottom: "1px solid #e5e7eb",
        padding: "0 2rem",
        height: "64px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="#2563eb" />
            <path d="M8 16.5L13 21.5L24 10.5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontWeight: 700, fontSize: "1.1rem", color: "#111827" }}>LMS Credit Core</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ fontSize: "0.875rem", color: "#6b7280" }}>
            {user?.firstName} {user?.lastName}
            <span style={{
              marginLeft: "8px",
              background: user?.role === "ADMIN" ? "#dbeafe" : "#f3f4f6",
              color: user?.role === "ADMIN" ? "#2563eb" : "#6b7280",
              padding: "2px 8px",
              borderRadius: "4px",
              fontSize: "0.75rem",
              fontWeight: 600,
            }}>
              {user?.role}
            </span>
          </span>
          <button
            onClick={handleLogout}
            style={{
              background: "none",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              padding: "6px 16px",
              fontSize: "0.85rem",
              color: "#6b7280",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#dc2626";
              e.currentTarget.style.color = "#dc2626";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#e5e7eb";
              e.currentTarget.style.color = "#6b7280";
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#111827", marginBottom: "0.5rem" }}>
          Bienvenido, {user?.firstName} 👋
        </h1>
        <p style={{ color: "#6b7280", marginBottom: "2rem" }}>
          Panel de gestión de préstamos — próximamente más funcionalidades aquí.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1rem" }}>
          {[
            { title: "Clientes", desc: "Gestionar clientes registrados", icon: "👥", color: "#2563eb" },
            { title: "Préstamos", desc: "Administrar créditos activos", icon: "💰", color: "#059669" },
            { title: "Pagos", desc: "Registrar y consultar pagos", icon: "💳", color: "#7c3aed" },
            { title: "Reportes", desc: "Próximamente", icon: "📊", color: "#9ca3af" },
          ].map((card) => (
            <div
              key={card.title}
              style={{
                background: "white",
                borderRadius: "12px",
                padding: "1.5rem",
                border: "1px solid #e5e7eb",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = card.color;
                e.currentTarget.style.boxShadow = `0 4px 12px ${card.color}15`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#e5e7eb";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>{card.icon}</div>
              <h3 style={{ fontWeight: 600, color: "#111827", marginBottom: "0.25rem" }}>{card.title}</h3>
              <p style={{ fontSize: "0.85rem", color: "#9ca3af" }}>{card.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
