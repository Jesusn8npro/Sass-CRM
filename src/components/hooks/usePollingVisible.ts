"use client";

import { useEffect, useRef } from "react";

/**
 * Hook de polling que se PAUSA automáticamente cuando la pestaña
 * no está visible (Page Visibility API). Reduce drásticamente la
 * cantidad de requests inútiles cuando el usuario tiene la app
 * abierta en otro tab o minimizada.
 *
 * Comportamiento:
 *  - Llama `fn` una vez al montar.
 *  - Mientras la pestaña esté visible, vuelve a llamarla cada `intervaloMs`.
 *  - Si la pestaña pasa a oculta (visibilitychange) → pausa.
 *  - Cuando vuelve a visible → llama `fn` inmediatamente y reanuda.
 *
 * @param fn       función a ejecutar (puede ser async)
 * @param intervaloMs  cada cuántos ms repetir (default 5000)
 * @param dependencias  array de deps que reinician el polling
 */
export function usePollingVisible(
  fn: () => void | Promise<void>,
  intervaloMs = 5000,
  dependencias: ReadonlyArray<unknown> = [],
): void {
  const refFn = useRef(fn);
  refFn.current = fn;

  useEffect(() => {
    let cancelado = false;
    let timer: NodeJS.Timeout | null = null;

    const ejecutar = () => {
      if (cancelado) return;
      try {
        const ret = refFn.current();
        if (ret instanceof Promise) ret.catch(() => {});
      } catch {
        /* ignorar */
      }
    };

    const arrancar = () => {
      detener();
      ejecutar(); // primera llamada inmediata
      timer = setInterval(ejecutar, intervaloMs);
    };

    const detener = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        arrancar();
      } else {
        detener();
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
      if (document.visibilityState === "visible") {
        arrancar();
      }
    }

    return () => {
      cancelado = true;
      detener();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervaloMs, ...dependencias]);
}
