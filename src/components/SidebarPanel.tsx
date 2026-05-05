"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Cuenta } from "@/lib/baseDatos";
import { BadgeNotificaciones } from "./BadgeNotificaciones";
import { InterruptorTema } from "./InterruptorTema";
import {
  IconoAgenda,
  IconoAgente,
  IconoClientes,
  IconoConocimiento,
  IconoConversaciones,
  IconoCreditos,
  IconoEstudio,
  IconoFunnel,
  IconoInversiones,
  IconoLeads,
  IconoLlamadas,
  IconoPlantillas,
  IconoProductos,
  IconoReportes,
  IconoSeguimientos,
  IconoWebhooks,
  IconoWhatsApp,
  IconoWhatsAppBusiness,
} from "./SidebarPanel.iconos";

interface InfoUsuario {
  usuario: { email: string; plan: string; es_admin?: boolean };
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
  const esAdmin = info?.usuario.es_admin === true;

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
          <ItemNav
            icono={<IconoWebhooks />}
            etiqueta="API Keys"
            href={`/app/cuentas/${idCuentaActual}/api-keys`}
            actual={pathname}
            matchPaths={["/api-keys"]}
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

        <SeccionNav titulo="IA · Crecimiento">
          <ItemNav
            icono={<IconoLeads />}
            etiqueta="Buscar leads"
            href={`/app/cuentas/${idCuentaActual}/leads`}
            actual={pathname}
          />
          <ItemNav
            icono={<IconoEstudio />}
            etiqueta="Estudio imágenes"
            href={`/app/cuentas/${idCuentaActual}/estudio`}
            actual={pathname}
          />
          <ItemNav
            icono={<IconoCreditos />}
            etiqueta="Créditos"
            href={`/app/cuentas/${idCuentaActual}/creditos`}
            actual={pathname}
          />
        </SeccionNav>

        {/* Sección de admin del SaaS — solo visible para los emails
            declarados en ADMIN_EMAIL. Si no es admin, nunca renderiza
            estos links. */}
        {esAdmin && (
          <SeccionNav titulo="Admin · Plataforma">
            <ItemNav
              icono={<IconoReportes />}
              etiqueta="Panel admin"
              href="/app/admin"
              actual={pathname}
              matchPaths={["/app/admin"]}
            />
            <ItemNav
              icono={<IconoClientes />}
              etiqueta="Usuarios"
              href="/app/admin/usuarios"
              actual={pathname}
              matchPaths={["/admin/usuarios"]}
            />
            <ItemNav
              icono={<IconoInversiones />}
              etiqueta="Ingresos"
              href="/app/admin/ingresos"
              actual={pathname}
              matchPaths={["/admin/ingresos"]}
            />
          </SeccionNav>
        )}
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
