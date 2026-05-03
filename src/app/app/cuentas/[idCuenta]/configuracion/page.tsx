"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type {
  Cuenta,
  EntradaConocimiento,
  EtiquetaConCount,
  MedioBiblioteca,
  RespuestaRapida,
} from "@/lib/baseDatos";
import { InterruptorTema } from "@/components/InterruptorTema";
import { CargandoOError } from "./_componentes/compartido";
import { TabGeneral } from "./_componentes/TabGeneral";
import { TabMensajes } from "./_componentes/TabMensajes";
import { TabCaptura } from "./_componentes/TabCaptura";
import { TabIA } from "./_componentes/TabIA";
import { TabLlamadas } from "./_componentes/TabLlamadas";

interface RespuestaCuenta {
  cuenta: Cuenta;
}
interface RespuestaConocimiento {
  entradas: EntradaConocimiento[];
}
interface RespuestaRespuestas {
  respuestas: RespuestaRapida[];
}
interface RespuestaEtiquetas {
  etiquetas: EtiquetaConCount[];
}
interface RespuestaBiblioteca {
  medios: MedioBiblioteca[];
}

export default function PaginaConfiguracion() {
  const params = useParams<{ idCuenta: string }>();
  const idCuenta = params?.idCuenta ?? "";

  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  const [conocimiento, setConocimiento] = useState<EntradaConocimiento[]>([]);
  const [respuestas, setRespuestas] = useState<RespuestaRapida[]>([]);
  const [etiquetas, setEtiquetas] = useState<EtiquetaConCount[]>([]);
  const [biblioteca, setBiblioteca] = useState<MedioBiblioteca[]>([]);
  const [error, setError] = useState<string | null>(null);

  const recargarCuenta = useCallback(async () => {
    if (!idCuenta) return;
    try {
      const res = await fetch(`/api/cuentas/${idCuenta}`, { cache: "no-store" });
      if (!res.ok) {
        setError("No se pudo cargar la cuenta");
        return;
      }
      const data = (await res.json()) as RespuestaCuenta;
      setCuenta(data.cuenta);
      setError(null);
    } catch {
      setError("Error de red al cargar la cuenta");
    }
  }, [idCuenta]);

  const recargarConocimiento = useCallback(async () => {
    if (!idCuenta) return;
    try {
      const res = await fetch(`/api/cuentas/${idCuenta}/conocimiento`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as RespuestaConocimiento;
      setConocimiento(data.entradas);
    } catch {
      // ignorar
    }
  }, [idCuenta]);

  const recargarRespuestas = useCallback(async () => {
    if (!idCuenta) return;
    try {
      const res = await fetch(`/api/cuentas/${idCuenta}/respuestas-rapidas`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as RespuestaRespuestas;
      setRespuestas(data.respuestas);
    } catch (err) {
      console.error("[configuracion] recargar respuestas:", err);
    }
  }, [idCuenta]);

  const recargarEtiquetas = useCallback(async () => {
    if (!idCuenta) return;
    try {
      const res = await fetch(`/api/cuentas/${idCuenta}/etiquetas`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as RespuestaEtiquetas;
      setEtiquetas(data.etiquetas);
    } catch (err) {
      console.error("[configuracion] recargar etiquetas:", err);
    }
  }, [idCuenta]);

  const recargarBiblioteca = useCallback(async () => {
    if (!idCuenta) return;
    try {
      const res = await fetch(`/api/cuentas/${idCuenta}/biblioteca`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as RespuestaBiblioteca;
      setBiblioteca(data.medios);
    } catch (err) {
      console.error("[configuracion] recargar biblioteca:", err);
    }
  }, [idCuenta]);

  useEffect(() => {
    recargarCuenta();
    recargarConocimiento();
    recargarRespuestas();
    recargarEtiquetas();
    recargarBiblioteca();
  }, [
    recargarCuenta,
    recargarConocimiento,
    recargarRespuestas,
    recargarEtiquetas,
    recargarBiblioteca,
  ]);

  if (!idCuenta) return <CargandoOError mensaje="ID de cuenta inválido" />;
  if (error && !cuenta) return <CargandoOError mensaje={error} />;
  if (!cuenta) return <CargandoOError mensaje="Cargando..." />;

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur-md md:px-6 md:py-4 dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link
              href="/app"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
              aria-label="Volver"
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
                <path d="M19 12H5" />
                <path d="m12 19-7-7 7-7" />
              </svg>
            </Link>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400">
                Agente IA · {cuenta.etiqueta}
              </p>
              <h1 className="mt-0.5 truncate text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                Configuración del Agente IA
              </h1>
            </div>
          </div>
          <InterruptorTema />
        </div>
      </header>

      <ContenidoConTabs
        cuenta={cuenta}
        setCuenta={setCuenta}
        conocimiento={conocimiento}
        respuestas={respuestas}
        etiquetas={etiquetas}
        biblioteca={biblioteca}
        recargarRespuestas={recargarRespuestas}
        recargarEtiquetas={recargarEtiquetas}
        recargarBiblioteca={recargarBiblioteca}
      />
    </main>
  );
}

type TabId = "general" | "mensajes" | "captura" | "ia" | "llamadas";

const TABS: { id: TabId; label: string; icono: string }[] = [
  { id: "general", label: "General", icono: "👤" },
  { id: "mensajes", label: "Mensajes", icono: "💬" },
  { id: "captura", label: "Captura de Datos", icono: "📋" },
  { id: "ia", label: "Configuración IA", icono: "⚙" },
  { id: "llamadas", label: "Llamadas Vapi", icono: "📞" },
];

function ContenidoConTabs({
  cuenta,
  setCuenta,
  conocimiento,
  respuestas,
  etiquetas,
  biblioteca,
  recargarRespuestas,
  recargarEtiquetas,
  recargarBiblioteca,
}: {
  cuenta: Cuenta;
  setCuenta: React.Dispatch<React.SetStateAction<Cuenta | null>>;
  conocimiento: EntradaConocimiento[];
  respuestas: RespuestaRapida[];
  etiquetas: EtiquetaConCount[];
  biblioteca: MedioBiblioteca[];
  recargarRespuestas: () => Promise<void>;
  recargarEtiquetas: () => Promise<void>;
  recargarBiblioteca: () => Promise<void>;
}) {
  const [tab, setTab] = useState<TabId>("general");

  const setCuentaSimple = (c: Cuenta) => setCuenta(c);

  return (
    <>
      <div className="sticky top-[64px] z-10 border-b border-zinc-200 bg-white/90 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex max-w-4xl gap-1 overflow-x-auto scroll-smooth px-3 [-ms-overflow-style:none] [scrollbar-width:none] md:px-6 [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-3 text-sm font-medium transition-colors md:px-4 ${
                tab === t.id
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              <span>{t.icono}</span>
              <span>{t.label}</span>
              {tab === t.id && (
                <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-t-full bg-emerald-500" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
        {tab === "general" && (
          <TabGeneral
            cuenta={cuenta}
            setCuenta={setCuentaSimple}
            conocimiento={conocimiento}
          />
        )}
        {tab === "mensajes" && (
          <TabMensajes
            cuenta={cuenta}
            setCuenta={setCuentaSimple}
            respuestas={respuestas}
            biblioteca={biblioteca}
            recargarRespuestas={recargarRespuestas}
            recargarBiblioteca={recargarBiblioteca}
          />
        )}
        {tab === "captura" && (
          <TabCaptura
            cuenta={cuenta}
            setCuenta={setCuenta}
            etiquetas={etiquetas}
            recargarEtiquetas={recargarEtiquetas}
          />
        )}
        {tab === "ia" && <TabIA cuenta={cuenta} setCuenta={setCuentaSimple} />}
        {tab === "llamadas" && (
          <TabLlamadas cuenta={cuenta} onActualizada={setCuentaSimple} />
        )}
      </div>
    </>
  );
}
