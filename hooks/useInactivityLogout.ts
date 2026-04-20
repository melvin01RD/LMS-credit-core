"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { INACTIVITY_TIMEOUT_MS } from "@/lib/config/session";

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
] as const;

const THROTTLE_MS = 1_000;
const CHANNEL_NAME = "lms_activity";
const PUBLIC_PATHS = ["/login", "/not-found"];

/**
 * Escucha actividad del usuario y dispara logout automático tras INACTIVITY_TIMEOUT_MS
 * de inactividad. Sincroniza el timer entre pestañas vía BroadcastChannel.
 * Solo activo en rutas protegidas (fuera de PUBLIC_PATHS).
 */
export function useInactivityLogout() {
  const router = useRouter();
  const pathname = usePathname();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(0);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const isProtected = !PUBLIC_PATHS.some((p) => pathname?.startsWith(p));

  useEffect(() => {
    if (!isProtected) return;

    async function logout() {
      if (timerRef.current) clearTimeout(timerRef.current);
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login?reason=inactivity");
    }

    function resetTimer() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(logout, INACTIVITY_TIMEOUT_MS);
    }

    function handleActivity() {
      const now = Date.now();
      if (now - lastActivityRef.current < THROTTLE_MS) return;
      lastActivityRef.current = now;
      resetTimer();
      channelRef.current?.postMessage("activity");
    }

    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;
    channel.onmessage = () => resetTimer();

    const passiveEvents = new Set(["scroll", "touchstart"]);
    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, {
        passive: passiveEvents.has(event),
      });
    });

    resetTimer();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      channel.close();
      channelRef.current = null;
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [isProtected, router]);
}
