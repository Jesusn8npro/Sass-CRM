"use client";

import { useCallback, useRef } from "react";

interface OpcionesLongPress {
  /** ms a mantener presionado para disparar. Default 500. */
  duracion?: number;
  /** Distancia máxima de movimiento permitida (en px) antes de cancelar. */
  toleranciaMovimiento?: number;
}

/**
 * Hook para detectar long-press (touch + mouse). Devuelve handlers
 * listos para spread sobre un elemento. El callback recibe las
 * coordenadas pageX/pageY del evento original — útil para posicionar
 * un menú contextual.
 */
export function useLongPress(
  onLongPress: (pos: { x: number; y: number }) => void,
  { duracion = 500, toleranciaMovimiento = 10 }: OpcionesLongPress = {},
) {
  const refTimer = useRef<NodeJS.Timeout | null>(null);
  const refInicio = useRef<{ x: number; y: number } | null>(null);

  const cancelar = useCallback(() => {
    if (refTimer.current) {
      clearTimeout(refTimer.current);
      refTimer.current = null;
    }
    refInicio.current = null;
  }, []);

  const iniciar = useCallback(
    (e: React.TouchEvent | React.PointerEvent) => {
      // Solo touch o pointer-touch dispara long-press. El click derecho
      // del mouse usa onContextMenu nativo, manejado por el caller.
      let x: number, y: number;
      if ("touches" in e) {
        const t = e.touches[0];
        if (!t) return;
        x = t.pageX;
        y = t.pageY;
      } else if ("pointerType" in e && e.pointerType === "touch") {
        x = e.pageX;
        y = e.pageY;
      } else {
        return;
      }
      refInicio.current = { x, y };
      refTimer.current = setTimeout(() => {
        if (refInicio.current) onLongPress(refInicio.current);
      }, duracion);
    },
    [onLongPress, duracion],
  );

  const onMover = useCallback(
    (e: React.TouchEvent | React.PointerEvent) => {
      if (!refInicio.current) return;
      let x: number, y: number;
      if ("touches" in e) {
        const t = e.touches[0];
        if (!t) return;
        x = t.pageX;
        y = t.pageY;
      } else {
        x = e.pageX;
        y = e.pageY;
      }
      const dx = Math.abs(x - refInicio.current.x);
      const dy = Math.abs(y - refInicio.current.y);
      if (dx > toleranciaMovimiento || dy > toleranciaMovimiento) {
        cancelar();
      }
    },
    [cancelar, toleranciaMovimiento],
  );

  return {
    onTouchStart: iniciar,
    onTouchEnd: cancelar,
    onTouchCancel: cancelar,
    onTouchMove: onMover,
    onContextMenu: (e: React.MouseEvent) => {
      // Click derecho desktop. Mostramos el menú en (pageX, pageY).
      e.preventDefault();
      onLongPress({ x: e.pageX, y: e.pageY });
    },
  };
}
