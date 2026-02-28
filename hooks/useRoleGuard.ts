// hooks/useRoleGuard.ts
// Uso: llamar al inicio de cualquier página protegida por rol
// Ejemplo: useRoleGuard("ADMIN") — redirige a /dashboard/unauthorized si el usuario no es ADMIN

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function useRoleGuard(requiredRole: "ADMIN" | "OPERATOR") {
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (!res.ok) {
          router.replace("/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        // /api/auth/me returns { user: { userId, email, firstName, lastName, role } }
        if (data.user?.role !== requiredRole) {
          router.replace("/dashboard/unauthorized");
        }
      })
      .catch(() => {
        router.replace("/login");
      });
  }, [requiredRole, router]);
}
