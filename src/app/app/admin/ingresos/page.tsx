"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/Toaster";

interface Pago {
  id: string;
  usuario_id: string;
  tipo: string;
  pasarela: string;
  monto_usd: number;
  estado: string;
  creditos_otorgados: number;
  paypal_subscription_id: string | null;
  creado_en: string;
}

interface Respuesta {
  pagos: Pago[];
  total: number;
  pagina: number;
  paginas: number;
}

const ESTADOS = [
  "",
  "pendiente",
  "aprobado",
  "fallido",
  "reembolsado",
  "cancelado",
] as const;

export default function PaginaAdminIngresos() {
  const { error: toastError } = useToast();
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [estado, setEstado] = useState("");
  const [mes, setMes] = useState(""); // formato YYYY-MM
  const [pagina, setPagina] = useState(1);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const params = new URLSearchParams();
      if (estado) params.set("estado", estado);
      if (mes) {
        // Convertir YYYY-MM a rango ISO [primero, primero del mes siguiente).
        const [ano, mm] = mes.split("-").map((s) => parseInt(s, 10));
        if (ano && mm) {
          const desde = new Date(ano, mm - 1, 1).toISOString();
          const hasta = new Date(ano, mm, 1).toISOString();
          params.set("desde", desde);
          params.set("hasta", hasta);
        }
      }
      params.set("pagina", String(pagina));
      const res = await fetch(`/api/admin/pagos?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        toastError("No se pudo cargar el historial");
        return;
      }
      setDatos((await res.json()) as Respuesta);
    } finally {
      setCargando(false);
    }
  }, [estado, mes, pagina, toastError]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const totalAprobados =
    datos?.pagos
      .filter((p) => p.estado === "aprobado")
      .reduce((acc, p) => acc + Number(p.monto_usd), 0) ?? 0;

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-300">
          // ingresos
        </p>
        <h1 className="font-display mt-2 text-4xl italic leading-tight text-white md:text-5xl">
          Historial de pagos
        </h1>
      </header>

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center">
        <select
          value={estado}
          onChange={(e) => {
            setPagina(1);
            setEstado(e.target.value);
          }}
          className="rounded-full border border-white/[0.06] bg-white/[0.02] px-4 py-2 font-mono text-xs uppercase tracking-wider text-white"
        >
          {ESTADOS.map((es) => (
            <option key={es || "todos"} value={es} className="bg-zinc-900">
              {es ? es : "todos los estados"}
            </option>
          ))}
        </select>
        <input
          type="month"
          value={mes}
          onChange={(e) => {
            setPagina(1);
            setMes(e.target.value);
          }}
          className="rounded-full border border-white/[0.06] bg-white/[0.02] px-4 py-2 font-mono text-xs text-white"
        />
        {(estado || mes) && (
          <button
            type="button"
            onClick={() => {
              setEstado("");
              setMes("");
              setPagina(1);
            }}
            className="font-mono text-[11px] uppercase tracking-wider text-white/50 hover:text-white"
          >
            limpiar
          </button>
        )}

        <span className="ml-auto font-mono text-[11px] uppercase tracking-wider text-white/40">
          aprobados en página: ${totalAprobados.toFixed(2)}
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
        <table className="w-full text-sm">
          <thead className="border-b border-white/[0.06] text-left font-mono text-[10px] uppercase tracking-wider text-white/40">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Monto (USD)</th>
              <th className="px-4 py-3 text-right">Créditos</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-white/40">
                  Cargando…
                </td>
              </tr>
            ) : !datos || datos.pagos.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-white/40">
                  Sin pagos
                </td>
              </tr>
            ) : (
              datos.pagos.map((p) => (
                <tr key={p.id} className="border-t border-white/[0.04]">
                  <td className="px-4 py-3 font-mono text-[11px] text-white/60">
                    {new Date(p.creado_en).toLocaleString("es-AR")}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-white/70">
                    <a
                      href={`/app/admin/usuarios/${p.usuario_id}`}
                      className="hover:text-emerald-300 hover:underline"
                    >
                      {p.usuario_id.slice(0, 8)}…
                    </a>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs uppercase tracking-wider text-white/80">
                    {p.tipo}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs uppercase tracking-wider">
                    <span className={pillPago(p.estado)}>{p.estado}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-white">
                    ${Number(p.monto_usd).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-white/70">
                    {p.creditos_otorgados || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {datos && datos.paginas > 1 && (
        <div className="mt-6 flex items-center justify-between font-mono text-[11px] text-white/50">
          <span>
            página {datos.pagina} de {datos.paginas} · {datos.total} pagos
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={datos.pagina <= 1}
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              className="rounded-full border border-white/[0.10] px-3 py-1 text-white/80 hover:border-white/30 disabled:opacity-40"
            >
              ← anterior
            </button>
            <button
              type="button"
              disabled={datos.pagina >= datos.paginas}
              onClick={() => setPagina((p) => p + 1)}
              className="rounded-full border border-white/[0.10] px-3 py-1 text-white/80 hover:border-white/30 disabled:opacity-40"
            >
              siguiente →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function pillPago(estado: string): string {
  const base =
    "inline-flex rounded-full border px-2 py-0.5 text-[10px] tracking-wider";
  if (estado === "aprobado")
    return `${base} border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-200`;
  if (estado === "fallido" || estado === "cancelado")
    return `${base} border-red-400/30 bg-red-400/[0.08] text-red-200`;
  if (estado === "pendiente")
    return `${base} border-amber-400/30 bg-amber-400/[0.08] text-amber-200`;
  return `${base} border-white/[0.10] bg-white/[0.04] text-white/70`;
}
