"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Cuenta } from "@/lib/baseDatos";
import { BadgeNotificaciones } from "./BadgeNotificaciones";
import { InterruptorTema } from "./InterruptorTema";

interface InfoUsuario {
  usuario: { email: string; plan: string };
  plan: { nombre: string; id: string };
  uso: { cuentas: number; limite_cuentas: number | null };
}

/**
 * Sidebar persistente del panel (visible en todas las páginas
 * dentro de `/app/cuentas/[idCuenta]/...`).
 *
 * Estructura:
 *  - Header: logo + selector de cuenta (dropdown si tiene > 1)
 *  - PRINCIPAL: Conversaciones, Clientes, Reportes, Agenda, Plantillas
 *  - CONFIGURACION: WhatsApp, Agente IA, Conocimiento, Funnel, Webhooks
 *  - Footer: notificaciones + tema + usuario
 */
export function SidebarPanel({
  idCuentaActual,
  cuentas,
  abierto = true,
  onCerrar,
}: {
  idCuentaActual: string;
  cuentas: Cuenta[];
  /** En mobile el sidebar es un drawer controlado por LayoutShellMovil.
   *  En desktop (lg+) `abierto` se ignora — siempre visible. */
  abierto?: boolean;
  /** Cierra el drawer cuando se navega a un link (solo aplica en mobile). */
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

  function cambiarCuenta(idNuevo: string) {
    setDropdownAbierto(false);
    if (idNuevo === idCuentaActual) return;
    // Reemplazar el idCuenta en la URL actual manteniendo la sub-ruta
    const subRuta = pathname?.split(`/cuentas/${idCuentaActual}`)[1] ?? "";
    router.push(`/app/cuentas/${idNuevo}${subRuta || "/conversaciones"}`);
    onCerrar?.();
  }

  return (
    <aside
      aria-label="Navegación principal"
      className={`fixed inset-y-0 left-0 z-50 flex h-screen w-[240px] flex-col border-r border-zinc-200 bg-white transition-transform duration-200 ease-out dark:border-zinc-800 dark:bg-zinc-950 lg:static lg:z-auto lg:translate-x-0 lg:shrink-0 ${
        abierto ? "translate-x-0" : "-translate-x-full"
      }`}
      onClickCapture={(e) => {
        // Cerrar drawer al hacer click en un Link interno (mobile only).
        const target = e.target as HTMLElement;
        if (target.closest("a[href]")) onCerrar?.();
      }}
    >
      {/* Header: logo + selector cuenta */}
      <div className="border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
        <Link href="/app" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-bold text-white shadow-sm">
            S
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold tracking-tight">
              Sass-CRM
            </p>
            <p className="text-[10px] text-zinc-500">Panel</p>
          </div>
        </Link>

        {/* Selector cuenta — dropdown si hay > 1 */}
        {cuentaActual && (
          <div className="relative mt-3">
            <button
              type="button"
              onClick={() =>
                cuentas.length > 1 && setDropdownAbierto((o) => !o)
              }
              className={`flex w-full items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-left dark:border-zinc-800 dark:bg-zinc-900 ${
                cuentas.length > 1 ? "hover:border-emerald-500/40" : ""
              }`}
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
                <p className="truncate text-xs font-semibold">
                  {cuentaActual.etiqueta}
                </p>
                {cuentaActual.telefono && (
                  <p className="truncate font-mono text-[9px] text-zinc-500">
                    +{cuentaActual.telefono}
                  </p>
                )}
              </div>
              {cuentas.length > 1 && (
                <span className="text-zinc-400">▾</span>
              )}
            </button>

            {dropdownAbierto && cuentas.length > 1 && (
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
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        c.estado === "conectado"
                          ? "bg-emerald-500"
                          : "bg-zinc-300"
                      }`}
                    />
                    <span className="truncate">{c.etiqueta}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navegación */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <SeccionNav titulo="Principal">
          <ItemNav
            icono={<IconoConversaciones />}
            etiqueta="Conversaciones"
            href={`/app/cuentas/${idCuentaActual}/conversaciones`}
            actual={pathname}
          />
          <ItemNav
            icono={<IconoClientes />}
            etiqueta="Clientes"
            href={`/app/cuentas/${idCuentaActual}/clientes`}
            actual={pathname}
          />
          <ItemNav
            icono={<IconoReportes />}
            etiqueta="Reportes"
            href={`/app/cuentas/${idCuentaActual}/dashboard`}
            actual={pathname}
            matchPaths={["/dashboard", "/reportes"]}
          />
          <ItemNav
            icono={<IconoAgenda />}
            etiqueta="Agenda"
            href={`/app/cuentas/${idCuentaActual}/agenda`}
            actual={pathname}
          />
          <ItemNav
            icono={<IconoPlantillas />}
            etiqueta="Plantillas"
            href={`/app/cuentas/${idCuentaActual}/plantillas`}
            actual={pathname}
          />
        </SeccionNav>

        <SeccionNav titulo="Configuración">
          <ItemNav
            icono={<IconoWhatsApp />}
            etiqueta="WhatsApp Web"
            href={`/app/cuentas/${idCuentaActual}/whatsapp`}
            actual={pathname}
          />
          <ItemNav
            icono={<IconoWhatsAppBusiness />}
            etiqueta="WhatsApp Business"
            href={`/app/cuentas/${idCuentaActual}/whatsapp-business`}
            actual={pathname}
            matchPaths={["/whatsapp-business"]}
          />
          <ItemNav
            icono={<IconoAgente />}
            etiqueta="Agente IA"
            href={`/app/cuentas/${idCuentaActual}/configuracion`}
            actual={pathname}
            matchPaths={["/configuracion", "/agente-ia"]}
          />
          <ItemNav
            icono={<IconoConocimiento />}
            etiqueta="Conocimiento"
            href={`/app/cuentas/${idCuentaActual}/conocimiento`}
            actual={pathname}
          />
          <ItemNav
            icono={<IconoFunnel />}
            etiqueta="Funnel"
            href={`/app/cuentas/${idCuentaActual}/pipeline`}
            actual={pathname}
            matchPaths={["/pipeline", "/funnel"]}
          />
          <ItemNav
            icono={<IconoWebhooks />}
            etiqueta="Webhooks"
            href={`/app/cuentas/${idCuentaActual}/webhooks`}
            actual={pathname}
          />
        </SeccionNav>

        <SeccionNav titulo="Ventas">
          <ItemNav
            icono={<IconoLlamadas />}
            etiqueta="Llamadas"
            href={`/app/cuentas/${idCuentaActual}/llamadas`}
            actual={pathname}
          />
          <ItemNav
            icono={<IconoProductos />}
            etiqueta="Productos"
            href={`/app/cuentas/${idCuentaActual}/productos`}
            actual={pathname}
          />
          <ItemNav
            icono={<IconoSeguimientos />}
            etiqueta="Seguimientos"
            href={`/app/cuentas/${idCuentaActual}/seguimientos`}
            actual={pathname}
          />
          <ItemNav
            icono={<IconoInversiones />}
            etiqueta="Inversiones"
            href={`/app/cuentas/${idCuentaActual}/inversiones`}
            actual={pathname}
          />
        </SeccionNav>
      </nav>

      {/* Footer: notif + tema + usuario */}
      <div className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between px-3 py-2">
          <BadgeNotificaciones />
          <InterruptorTema />
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
              <p className="truncate text-[11px] font-medium">
                {email || "Cargando…"}
              </p>
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

// ============================================================
// Sub-componentes
// ============================================================

function SeccionNav({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        {titulo}
      </p>
      <ul className="flex flex-col gap-0.5">{children}</ul>
    </div>
  );
}

function ItemNav({
  icono,
  etiqueta,
  href,
  actual,
  matchPaths,
}: {
  icono: React.ReactNode;
  etiqueta: string;
  href: string;
  actual: string | null;
  matchPaths?: string[];
}) {
  const candidatos = matchPaths ?? [href.split("/").pop() ?? ""];
  const activo = !!actual && candidatos.some((p) => actual.includes(p));
  return (
    <li className="relative">
      {activo && (
        <span
          aria-hidden
          className="absolute inset-y-1 left-0 w-[3px] rounded-r-full bg-gradient-to-b from-emerald-400 to-teal-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
        />
      )}
      <Link
        href={href}
        className={`group flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs transition-all ${
          activo
            ? "bg-gradient-to-r from-emerald-500/10 to-transparent font-semibold text-emerald-700 dark:text-emerald-300"
            : "text-zinc-600 hover:translate-x-0.5 hover:bg-zinc-100/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/40 dark:hover:text-zinc-100"
        }`}
      >
        <span
          className={`shrink-0 transition-transform ${activo ? "scale-110" : "group-hover:scale-105"}`}
        >
          {icono}
        </span>
        <span className="truncate">{etiqueta}</span>
      </Link>
    </li>
  );
}

// ============================================================
// Iconos (SVG inline para no depender de libs)
// ============================================================

const props = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor" as const,
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "h-3.5 w-3.5",
};

const IconoConversaciones = () => (
  <svg {...props}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);
const IconoClientes = () => (
  <svg {...props}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const IconoReportes = () => (
  <svg {...props}>
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);
const IconoAgenda = () => (
  <svg {...props}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const IconoPlantillas = () => (
  <svg {...props}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    <path d="M8 9h8M8 13h5" />
  </svg>
);
const IconoWhatsApp = () => (
  <svg {...props}>
    <path d="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5l-3 3V6a2 2 0 0 1 2-2z" />
    <path d="M9 10h.01M12 10h.01M15 10h.01" />
  </svg>
);
const IconoWhatsAppBusiness = () => (
  <svg {...props}>
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    <circle cx="12" cy="11" r="1" fill="currentColor" />
  </svg>
);
const IconoAgente = () => (
  <svg {...props}>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7v4" />
    <line x1="8" y1="16" x2="8" y2="16" />
    <line x1="16" y1="16" x2="16" y2="16" />
  </svg>
);
const IconoConocimiento = () => (
  <svg {...props}>
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
  </svg>
);
const IconoFunnel = () => (
  <svg {...props}>
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);
const IconoWebhooks = () => (
  <svg {...props}>
    <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.91 2.92 2.91s2.92-1.3 2.92-2.91c0-1.61-1.31-2.92-2.92-2.92z" />
  </svg>
);
const IconoLlamadas = () => (
  <svg {...props}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);
const IconoProductos = () => (
  <svg {...props}>
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
  </svg>
);
const IconoSeguimientos = () => (
  <svg {...props}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);
const IconoInversiones = () => (
  <svg {...props}>
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);
