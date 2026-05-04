"use client";

import { useEffect, useRef } from "react";

/**
 * Polling que se pausa cuando la pestaña no está visible. Reduce ~70%
 * de QPS contra el servidor cuando el usuario tiene la app en
 * background (Chrome agresivo con Page Lifecycle).
 *
 * Llama `fn` inmediatamente y luego cada `intervaloMs`. Cuando el doc
 * vuelve a visibilityState=visible, dispara un fetch inmediato (UX:
 * datos frescos al volver al tab) y reanuda el ciclo.
 */
export function usePollingVisible(
  fn: () => void | Promise<void>,
  intervaloMs: number,
  habilitado: boolean = true,
): void {
  const refFn = useRef(fn);
  refFn.current = fn;

  useEffect(() => {
    if (!habilitado) return;
    let timer: ReturnType<typeof setInterval> | null = null;

    const arrancar = () => {
      if (timer !== null) return;
      void refFn.current();
      timer = setInterval(() => void refFn.current(), intervaloMs);
    };
    const parar = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") arrancar();
      else parar();
    };

    if (document.visibilityState === "visible") arrancar();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      parar();
    };
  }, [intervaloMs, habilitado]);
}
