"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type {
  Conversacion,
  ConversacionConPreview,
  Cuenta,
} from "@/lib/baseDatos";
import { BarraLateralCuentas, type CuentaConEstado } from "./BarraLateralCuentas";
import { ModalNuevaCuenta } from "./ModalNuevaCuenta";
import { ModalNuevaConversacion } from "./ModalNuevaConversacion";
import { EncabezadoCuenta } from "./EncabezadoCuenta";
import { BannerBotInactivo } from "./BannerBotInactivo";
import { PantallaQR } from "./PantallaQR";
import { ListaConversaciones } from "./ListaConversaciones";
import { PanelConversacion } from "./PanelConversacion";

interface RespuestaCuentas {
  cuentas: CuentaConEstado[];
}

interface RespuestaConversaciones {
  conversaciones: ConversacionConPreview[];
}

export function PuertaConexion() {
  const searchParams = useSearchParams();
  const [cuentas, setCuentas] = useState<CuentaConEstado[]>([]);
  const [cargandoCuentas, setCargandoCuentas] = useState(true);
  const [idCuentaSeleccionada, setIdCuentaSeleccionada] = useState<number | null>(null);
  const [conversaciones, setConversaciones] = useState<ConversacionConPreview[]>([]);
  const [idConvSeleccionada, setIdConvSeleccionada] = useState<number | null>(null);
  const [modalNueva, setModalNueva] = useState(false);
  const [modalNuevaConv, setModalNuevaConv] = useState(false);
  const [drawerCuentasAbierto, setDrawerCuentasAbierto] = useState(false);
  // Marca la última cuenta para la que ya hicimos auto-select de conversación.
  // Sin esto, el botón "Volver" en móvil quedaba pisado: limpiabas idConv y
  // el effect lo volvía a setear instantáneamente.
  const refCuentaAutoSeleccionada = useRef<number | null>(null);
  // Deep-link ?cuenta=X&conv=Y solo se aplica una vez al montar.
  const refDeepLinkAplicado = useRef(false);

  // Función estable que SIEMPRE limpia conv + lista al cambiar cuenta.
  // Llamamos esto desde el handler del click en la sidebar Y también
  // desde los effects de auto-selección. Así evitamos que un idConv viejo
  // de la cuenta anterior se mezcle con la nueva (causaba 403 spam).
  const seleccionarCuenta = useCallback((id: number | null) => {
    setIdCuentaSeleccionada(id);
    setIdConvSeleccionada(null);
    setConversaciones([]);
  }, []);

  // Polling de cuentas cada 3s (incluye qr_png si aplica, así
  // PantallaQR no necesita su propio polling separado)
  useEffect(() => {
    let cancelado = false;
    async function chequear() {
      try {
        const res = await fetch("/api/cuentas", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as RespuestaCuentas;
        if (cancelado) return;
        setCuentas(data.cuentas);
      } catch {
        // ignorar
      } finally {
        if (!cancelado) setCargandoCuentas(false);
      }
    }
    chequear();
    const intervalo = setInterval(chequear, 3000);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, []);

  // Aplicar deep-link ?cuenta=X&conv=Y una sola vez cuando la lista llegó.
  useEffect(() => {
    if (refDeepLinkAplicado.current) return;
    if (cuentas.length === 0) return;
    const idCuentaParam = Number(searchParams?.get("cuenta") ?? "");
    if (
      Number.isFinite(idCuentaParam) &&
      idCuentaParam > 0 &&
      cuentas.some((c) => c.id === idCuentaParam)
    ) {
      seleccionarCuenta(idCuentaParam);
      const idConvParam = Number(searchParams?.get("conv") ?? "");
      if (Number.isFinite(idConvParam) && idConvParam > 0) {
        // Esperamos al próximo effect (cuando carguen conversaciones)
        // a que setee la conv. Para que no la pise el auto-select.
        setIdConvSeleccionada(idConvParam);
        refCuentaAutoSeleccionada.current = idCuentaParam;
      }
    }
    refDeepLinkAplicado.current = true;
  }, [cuentas, searchParams, seleccionarCuenta]);

  // Auto-seleccionar la primera cuenta si no hay ninguna seleccionada
  useEffect(() => {
    if (idCuentaSeleccionada !== null) return;
    if (cuentas.length === 0) return;
    seleccionarCuenta(cuentas[0]!.id);
  }, [cuentas, idCuentaSeleccionada, seleccionarCuenta]);

  // Si la cuenta seleccionada se archivó, limpiar selección
  useEffect(() => {
    if (idCuentaSeleccionada === null) return;
    if (cuentas.length === 0) {
      seleccionarCuenta(null);
      return;
    }
    if (!cuentas.some((c) => c.id === idCuentaSeleccionada)) {
      seleccionarCuenta(cuentas[0]!.id);
    }
  }, [cuentas, idCuentaSeleccionada, seleccionarCuenta]);

  const cuentaActual = cuentas.find((c) => c.id === idCuentaSeleccionada) ?? null;

  // Polling de conversaciones cuando hay cuenta seleccionada Y conectada
  useEffect(() => {
    if (!idCuentaSeleccionada) return;
    if (cuentaActual?.estado !== "conectado") return;
    let cancelado = false;
    async function cargar() {
      try {
        const res = await fetch(
          `/api/cuentas/${idCuentaSeleccionada}/conversaciones`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as RespuestaConversaciones;
        if (cancelado) return;
        setConversaciones(data.conversaciones);
      } catch {
        // ignorar
      }
    }
    cargar();
    const intervalo = setInterval(cargar, 3000);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, [idCuentaSeleccionada, cuentaActual?.estado]);

  // Auto-seleccionar primera conversación SOLO la primera vez por cuenta.
  // En desktop: igual que antes (se ve la primera al entrar).
  // En móvil: si el usuario clickeó "Volver", la cuenta no cambió, así
  // que ref ya marca esa cuenta como auto-seleccionada y NO re-elegimos.
  useEffect(() => {
    if (idCuentaSeleccionada === null) return;
    if (idConvSeleccionada !== null) return;
    if (conversaciones.length === 0) return;
    if (refCuentaAutoSeleccionada.current === idCuentaSeleccionada) return;
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      // En móvil no auto-seleccionamos: el usuario elige desde la lista.
      refCuentaAutoSeleccionada.current = idCuentaSeleccionada;
      return;
    }
    refCuentaAutoSeleccionada.current = idCuentaSeleccionada;
    setIdConvSeleccionada(conversaciones[0]!.id);
  }, [conversaciones, idConvSeleccionada, idCuentaSeleccionada]);

  const conversacionBorrada = useCallback((id: number) => {
    setConversaciones((prev) => prev.filter((c) => c.id !== id));
    setIdConvSeleccionada((prev) => (prev === id ? null : prev));
  }, []);

  function alCrearCuenta(nueva: Cuenta) {
    setCuentas((prev) => [...prev, { ...nueva, bot_vivo: false }]);
    setIdCuentaSeleccionada(nueva.id);
    setModalNueva(false);
  }

  const alIniciarConversacion = useCallback(
    (conv: Conversacion) => {
      setConversaciones((prev) => {
        if (prev.some((c) => c.id === conv.id)) return prev;
        return [
          {
            ...conv,
            vista_previa_ultimo_mensaje: null,
            etiquetas: [],
          },
          ...prev,
        ];
      });
      setIdConvSeleccionada(conv.id);
      setModalNuevaConv(false);
    },
    [],
  );

  if (cargandoCuentas) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-zinc-500">
          <span className="h-2 w-2 animate-pulso-suave rounded-full bg-zinc-400 dark:bg-zinc-600" />
          Cargando...
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-screen w-screen overflow-hidden">
      {/* Sidebar de cuentas:
          - Desktop (md+): siempre visible
          - Mobile: oculta por default, drawer cuando drawerCuentasAbierto */}
      <div className="hidden md:flex">
        <BarraLateralCuentas
          cuentas={cuentas}
          idSeleccionada={idCuentaSeleccionada}
          onSeleccionar={seleccionarCuenta}
          onNueva={() => setModalNueva(true)}
        />
      </div>
      {drawerCuentasAbierto && (
        <div
          className="fixed inset-0 z-40 flex md:hidden"
          onClick={() => setDrawerCuentasAbierto(false)}
        >
          <div
            className="bg-black/40 flex-1"
            aria-hidden="true"
          />
          <div
            className="absolute left-0 top-0 bottom-0 flex"
            onClick={(e) => e.stopPropagation()}
          >
            <BarraLateralCuentas
              cuentas={cuentas}
              idSeleccionada={idCuentaSeleccionada}
              onSeleccionar={(id) => {
                seleccionarCuenta(id);
                setDrawerCuentasAbierto(false);
              }}
              onNueva={() => {
                setModalNueva(true);
                setDrawerCuentasAbierto(false);
              }}
            />
          </div>
        </div>
      )}

      <section className="flex flex-1 min-w-0 flex-col">
        {!cuentaActual ? (
          <EmptyStateSinCuenta onNueva={() => setModalNueva(true)} />
        ) : (
          <>
            <EncabezadoCuenta
              cuenta={cuentaActual}
              onAbrirCuentas={() => setDrawerCuentasAbierto(true)}
              onDesconectar={() => {
                // Optimista: marcar como desconectada localmente
                setCuentas((prev) =>
                  prev.map((c) =>
                    c.id === cuentaActual.id
                      ? { ...c, estado: "desconectado", telefono: null }
                      : c,
                  ),
                );
              }}
            />
            <BannerBotInactivo visible={!cuentaActual.bot_vivo} />
            {cuentaActual.estado !== "conectado" ? (
              <PantallaQR
                idCuenta={cuentaActual.id}
                etiquetaCuenta={cuentaActual.etiqueta}
                estado={cuentaActual.estado}
                qrPng={cuentaActual.qr_png ?? null}
                botVivo={!!cuentaActual.bot_vivo}
              />
            ) : (
              <div className="grid flex-1 min-h-0 md:grid-cols-[320px_1fr]">
                {/* Lista de conversaciones — en móvil solo se muestra
                    cuando NO hay conversación seleccionada */}
                <aside
                  className={`min-h-0 flex-col overflow-y-auto border-zinc-200 bg-white/40 dark:border-zinc-800 dark:bg-zinc-950/40 md:flex md:border-r ${
                    idConvSeleccionada !== null
                      ? "hidden md:flex"
                      : "flex"
                  }`}
                >
                  <div className="sticky top-0 z-10 flex items-start justify-between gap-2 border-b border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                        Conversaciones
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-600">
                        {conversaciones.length}{" "}
                        {conversaciones.length === 1
                          ? "chat activo"
                          : "chats activos"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setModalNuevaConv(true)}
                      title="Iniciar conversación"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white transition-all hover:bg-emerald-400"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4"
                      >
                        <path d="M12 5v14" />
                        <path d="M5 12h14" />
                      </svg>
                    </button>
                  </div>
                  <ListaConversaciones
                    conversaciones={conversaciones}
                    idSeleccionada={idConvSeleccionada}
                    onSeleccionar={setIdConvSeleccionada}
                  />
                </aside>
                {/* Panel de conversación — en móvil solo se muestra
                    cuando HAY conv seleccionada */}
                <section
                  className={`overflow-hidden ${
                    idConvSeleccionada !== null
                      ? "flex flex-col"
                      : "hidden md:flex md:flex-col"
                  }`}
                >
                  {idConvSeleccionada !== null &&
                  conversaciones.some((c) => c.id === idConvSeleccionada) ? (
                    <>
                      {/* Botón "← volver" solo en móvil */}
                      <button
                        type="button"
                        onClick={() => setIdConvSeleccionada(null)}
                        className="flex shrink-0 items-center gap-2 border-b border-zinc-200 bg-white/80 px-4 py-2 text-xs font-medium text-zinc-600 backdrop-blur-md transition-colors hover:bg-zinc-50 md:hidden dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-400 dark:hover:bg-zinc-900"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4"
                        >
                          <path d="m15 18-6-6 6-6" />
                        </svg>
                        Volver a conversaciones
                      </button>
                      <div className="flex-1 min-h-0">
                        <PanelConversacion
                          key={`${cuentaActual.id}-${idConvSeleccionada}`}
                          idCuenta={cuentaActual.id}
                          idConversacion={idConvSeleccionada}
                          cuenta={cuentaActual}
                          onConversacionBorrada={conversacionBorrada}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="flex h-full items-center justify-center px-6">
                      <div className="max-w-sm rounded-2xl border border-dashed border-zinc-200 bg-white/60 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/30">
                        <p className="text-base font-medium text-zinc-900 dark:text-zinc-200">
                          Selecciona una conversación
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                          Elige un chat de la izquierda o esperá a que llegue
                          uno nuevo.
                        </p>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            )}
          </>
        )}
      </section>

      <ModalNuevaCuenta
        abierto={modalNueva}
        onCerrar={() => setModalNueva(false)}
        onCreada={alCrearCuenta}
      />

      {cuentaActual && (
        <ModalNuevaConversacion
          abierto={modalNuevaConv}
          idCuenta={cuentaActual.id}
          onCerrar={() => setModalNuevaConv(false)}
          onCreada={alIniciarConversacion}
        />
      )}
    </main>
  );
}

function EmptyStateSinCuenta({ onNueva }: { onNueva: () => void }) {
  return (
    <div className="flex h-full flex-1 items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6 text-emerald-600 dark:text-emerald-400"
          >
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Empezá agregando tu primera cuenta
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          Cada cuenta de WhatsApp tiene su propio número, su propio prompt
          de IA, y sus propias conversaciones. Podés conectar varias y
          alternar entre ellas desde la barra lateral.
        </p>
        <button
          type="button"
          onClick={onNueva}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-emerald-400"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
          Crear cuenta
        </button>
      </div>
    </div>
  );
}
