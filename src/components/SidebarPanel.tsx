"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Cuenta } from "@/lib/baseDatos";
import { BadgeNotificaciones } from "./BadgeNotificaciones";
import { InterruptorTema } from "./InterruptorTema";
import { PillCreditos } from "./PillCreditos";
import { SeccionNav, ItemNav } from "./SidebarPanel.helpers";
import {
  IconoAgenda,
  IconoAgente,
  IconoBroadcast,
  IconoClientes,
  IconoConocimiento,
  IconoConversaciones,
  IconoCreditos,
  IconoEmbudo,
  IconoEstudio,
  IconoFunnel,
  IconoInversiones,
  IconoLeads,
  IconoLlamadas,
  IconoPlantillas,
  IconoProductos,
  IconoReportes,
  IconoSeguimientos,
  IconoSoporte,
  IconoWebhooks,
  IconoWhatsApp,
} from "./SidebarPanel.iconos";

interface InfoUsuario {
  usuario: { email: string; plan: string; es_admin?: boolean };
  plan: { nombre: string; id: string };
  uso: { cuentas: number; limite_cuentas: number | null };
}

export function SidebarPanel({
  idCuentaActual,
  cuentas,
  abierto = true,
  onCerrar,
}: {
  idCuentaActual: string;
  cuentas: Cuenta[];
  abierto?: boolean;
  onCerrar?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [info, setInfo] = useState<InfoUsuario | null>(null);
  const [dropdownAbierto, setDropdownAbierto] = useState(false);

  useEffect(() => {
    fetch("/api/usuarios/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: InfoUsuario | null) => d && setInfo(d))
      .catch(() => {});
  }, []);

  const cuentaActual = cuentas.find((c) => c.id === idCuentaActual);
  const email = info?.usuario.email ?? "";
  const planId = info?.plan.id ?? "free";
  const planNombre = info?.plan.nombre ?? "Gratis";
  const esAdmin = info?.usuario.es_admin === true;
  const b = `/app/cuentas/${idCuentaActual}`;

  function cambiarCuenta(idNuevo: string) {
    setDropdownAbierto(false);
    if (idNuevo === idCuentaActual) return;
    const subRuta = pathname?.split(`/cuentas/${idCuentaActual}`)[1] ?? "";
    router.push(`/app/cuentas/${idNuevo}${subRuta || "/dashboard"}`);
    onCerrar?.();
  }

  return (
    <aside
      id="sidebar-principal"
      aria-label="Navegación principal"
      className={`fixed inset-y-0 left-0 z-50 flex h-screen w-[240px] flex-col border-r border-borde bg-superficie transition-transform duration-200 ease-out lg:static lg:z-auto lg:translate-x-0 lg:shrink-0 ${
        abierto ? "translate-x-0" : "-translate-x-full"
      }`}
      onClickCapture={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest("a[href]")) onCerrar?.();
      }}
    >
      {/* Header: logo + selector cuenta */}
      <div className="border-b border-borde px-4 py-4">
        <Link href="/app" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-marca-500 to-marca-600 text-[10px] font-black text-white shadow-[var(--shadow-glow-marca-sm)]">
            IA
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-tight text-texto">INYECTAIA</p>
            <p className="text-[10px] uppercase tracking-wider text-texto-tenue">Panel</p>
          </div>
        </Link>

        {cuentaActual && (
          <div className="relative mt-3">
            <button
              type="button"
              onClick={() => setDropdownAbierto((o) => !o)}
              className="flex w-full items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-left transition-colors hover:border-emerald-500/40 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  cuentaActual.estado === "conectado"
                    ? "bg-emerald-500"
                    : cuentaActual.estado === "qr"
                    ? "bg-amber-500"
                    : "bg-zinc-300"
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">{cuentaActual.etiqueta}</p>
                {cuentaActual.telefono && (
                  <p className="truncate font-mono text-[9px] text-zinc-500">+{cuentaActual.telefono}</p>
                )}
              </div>
              <span className="text-zinc-400">▾</span>
            </button>

            {dropdownAbierto && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                {cuentas.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => cambiarCuenta(c.id)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
                      c.id === idCuentaActual ? "bg-emerald-500/5" : ""
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${c.estado === "conectado" ? "bg-emerald-500" : "bg-zinc-300"}`} />
                    <span className="truncate">{c.etiqueta}</span>
                  </button>
                ))}
                <div className="my-1 border-t border-zinc-200 dark:border-zinc-700" />
                <Link
                  href="/app/cuentas/nueva"
                  onClick={() => setDropdownAbierto(false)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/5"
                >
                  <span className="text-base leading-none">+</span>
                  <span>Conectar otra cuenta</span>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navegación */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">

        {/* ── PRINCIPAL ────────────────────────────────────── */}
        <SeccionNav titulo="Principal">
          <ItemNav icono={<IconoReportes />}      etiqueta="Dashboard"      href={`${b}/dashboard`}      actual={pathname} matchPaths={["dashboard"]} />
          <ItemNav icono={<IconoConversaciones />} etiqueta="Conversaciones" href={`${b}/conversaciones`} actual={pathname} />
          <ItemNav icono={<IconoClientes />}       etiqueta="Clientes"       href={`${b}/clientes`}       actual={pathname} />
          <ItemNav icono={<IconoAgenda />}         etiqueta="Agenda"         href={`${b}/agenda`}         actual={pathname} />
        </SeccionNav>

        {/*
          ── CAPTACIÓN ────────────────────────────────────────
          Flujo: Buscar leads (Apify) → Pipeline outreach
          Las sub-páginas (asistente, llamadas, correos) están
          accesibles desde la página de Pipeline con sus cards.
        */}
        <SeccionNav titulo="Captación">
          <ItemNav icono={<IconoLeads />}          etiqueta="Importar leads" href={`${b}/leads`}          actual={pathname} />
          <ItemNav icono={<IconoConversaciones />} etiqueta="Leads Chat Web" href={`${b}/leads-chat-web`} actual={pathname} matchPaths={["leads-chat-web"]} />
          <ItemNav icono={<IconoFunnel />}         etiqueta="Prospección"    href={`${b}/prospeccion`}    actual={pathname} matchPaths={["prospeccion"]} />
        </SeccionNav>

        {/* ── VENTAS ───────────────────────────────────────── */}
        <SeccionNav titulo="Ventas">
          <ItemNav icono={<IconoEmbudo />}       etiqueta="Embudo CRM"   href={`${b}/pipeline`}     actual={pathname} matchPaths={["pipeline"]} />
          <ItemNav icono={<IconoSeguimientos />} etiqueta="Seguimientos" href={`${b}/seguimientos`} actual={pathname} />
          <ItemNav icono={<IconoLlamadas />}     etiqueta="Llamadas"     href={`${b}/llamadas`}     actual={pathname} matchPaths={["llamadas"]} />
          <ItemNav icono={<IconoInversiones />}  etiqueta="Inversiones"  href={`${b}/inversiones`}  actual={pathname} />
          <ItemNav icono={<IconoBroadcast />}    etiqueta="Broadcast"    href={`${b}/broadcast`}    actual={pathname} />
        </SeccionNav>

        {/* ── CONFIGURACIÓN ────────────────────────────────── */}
        <SeccionNav titulo="Configuración">
          <ItemNav icono={<IconoAgente />}           etiqueta="Agente IA"    href={`${b}/configuracion`}     actual={pathname} />
          <ItemNav icono={<IconoWhatsApp />}          etiqueta="WhatsApp"     href={`${b}/whatsapp`}          actual={pathname} />
          <ItemNav icono={<IconoProductos />}         etiqueta="Catálogo"     href={`${b}/productos`}         actual={pathname} />
          <ItemNav icono={<IconoConocimiento />}      etiqueta="Conocimiento" href={`${b}/conocimiento`}      actual={pathname} />
          <ItemNav icono={<IconoPlantillas />}        etiqueta="Plantillas"   href={`${b}/plantillas`}        actual={pathname} />
          <ItemNav icono={<IconoWebhooks />}          etiqueta="Integraciones" href={`${b}/webhooks`}         actual={pathname} matchPaths={["webhooks", "api-keys"]} />
          <ItemNav icono={<IconoConocimiento />}      etiqueta="Tu Supabase"  href={`${b}/supabase-externo`}  actual={pathname} matchPaths={["supabase-externo"]} />
        </SeccionNav>

        {/* ── MI CUENTA ────────────────────────────────────── */}
        <SeccionNav titulo="Mi Cuenta">
          <ItemNav icono={<IconoEstudio />}  etiqueta="Imágenes IA" href={`${b}/estudio`}  actual={pathname} />
          <ItemNav icono={<IconoCreditos />} etiqueta="Créditos"   href={`${b}/creditos`} actual={pathname} />
          <ItemNav icono={<IconoReportes />} etiqueta="Reportes"   href={`${b}/reportes`} actual={pathname} />
          <ItemNav icono={<IconoSoporte />}  etiqueta="Soporte"    href={`${b}/soporte`}  actual={pathname} />
        </SeccionNav>

        {/* ── ADMIN (solo visible para admins) ─────────────── */}
        {esAdmin && (
          <SeccionNav titulo="Admin · Plataforma">
            <ItemNav icono={<IconoReportes />}    etiqueta="Panel admin" href="/app/admin"          actual={pathname} matchPaths={["/app/admin"]} />
            <ItemNav icono={<IconoClientes />}    etiqueta="Usuarios"    href="/app/admin/usuarios" actual={pathname} matchPaths={["admin/usuarios"]} />
            <ItemNav icono={<IconoInversiones />} etiqueta="Ingresos"    href="/app/admin/ingresos" actual={pathname} matchPaths={["admin/ingresos"]} />
          </SeccionNav>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between px-3 py-2">
          <BadgeNotificaciones />
          <div className="flex items-center gap-2">
            <PillCreditos idCuenta={idCuentaActual} />
            <InterruptorTema />
          </div>
        </div>
        <Link
          href="/app/mi-cuenta"
          className="block border-t border-zinc-200 px-3 py-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-[10px] font-bold text-white">
              {email ? email.slice(0, 2).toUpperCase() : "··"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium">{email || "Cargando…"}</p>
              <span
                className={`mt-0.5 inline-block rounded-full px-1.5 py-px text-[8px] font-bold uppercase tracking-wider ${
                  planId === "free"
                    ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
                    : planId === "pro"
                    ? "bg-emerald-500 text-white"
                    : "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                }`}
              >
                {planNombre}
              </span>
            </div>
          </div>
        </Link>
      </div>
    </aside>
  );
}
