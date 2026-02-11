"use client";

import { useParams } from "next/navigation";

export default function LoanDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#111827", marginBottom: "8px" }}>
        Detalle del Préstamo
      </h1>
      <p style={{ color: "#6b7280" }}>Préstamo ID: {id} — módulo en construcción.</p>
    </div>
  );
}
