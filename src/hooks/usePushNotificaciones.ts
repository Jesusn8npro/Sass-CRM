"use client";
import { useState, useCallback } from "react";

export type EstadoPush = "inactivo" | "suscrito" | "denegado";

export function usePushNotificaciones(idCuenta: string) {
  const [estado, setEstado] = useState<EstadoPush>("inactivo");

  const suscribir = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const permiso = await Notification.requestPermission();
    if (permiso !== "granted") {
      setEstado("denegado");
      return;
    }

    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublic) {
      console.error("[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY no configurada");
      return;
    }

    const rawKey = vapidPublic.replace(/-/g, "+").replace(/_/g, "/");
    const appServerKey = Uint8Array.from(atob(rawKey), (c) => c.charCodeAt(0));

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: appServerKey,
    });

    const subJson = sub.toJSON() as {
      endpoint: string;
      keys: Record<string, string>;
    };

    const res = await fetch("/api/push/suscribir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idCuenta, subscription: subJson }),
    });

    if (res.ok) {
      setEstado("suscrito");
    }
  }, [idCuenta]);

  return { suscribir, estado };
}
