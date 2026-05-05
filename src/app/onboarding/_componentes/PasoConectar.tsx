"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toaster";

interface CuentaMin {
  id: string;
  etiqueta: string;
  estado: "desconectado" | "qr" | "conectando" | "conectado";
  telefono: string | null;
  cadena_qr?: string | null;
  qr_png?: string | null;
}

/**
 * Paso 1 — Conectar WhatsApp. Bloqueante (sin "saltar").
 *
 * Si el usuario aún no tiene cuenta: muestra form para crearla.
 * Si ya tiene cuenta: muestra QR en vivo + cambia automáticamente
 * al paso 2 cuando estado = "conectado".
 */
export function PasoConectar({
  cuentaInicial,
}: {
  cuentaInicial: CuentaMin | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [cuenta, setCuenta] = useState<CuentaMin | null>(cuentaInicial);
  const [etiqueta, setEtiqueta] = useState("");
  const [creando, setCreando] = useState(false);

  // Polling del estado de conexión cada 3.5s mientras estemos en este paso.
  useEffect(() => {
    if (!cuenta?.id) return;
    let detenido = false;

    async function consultar() {
      try {
        const res = await fetch(`/api/cuentas/${cuenta!.id}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { cuenta: CuentaMin };
        if (!detenido && data.cuenta) {
          setCuenta(data.cuenta);
          if (data.cuenta.estado === "conectado") {
            // Avanzar automáticamente al paso 2
            await marcarPaso("plantilla");
            router.replace("/onboarding/plantilla");
          }
        }
      } catch {
        /* silencio: red intermitente */
      }
    }

    void consultar();
    const t = setInterval(consultar, 3500);
    return () => {
      detenido = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuenta?.id]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!etiqueta.trim() || creando) return;
    setCreando(true);
    try {
      const res = await fetch("/api/cuentas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etiqueta: etiqueta.trim() }),
      });
      const data = (await res.json()) as
        | { cuenta: CuentaMin }
        | { error: string };
      if (!res.ok || !("cuenta" in data)) {
        toast.error(("error" in data && data.error) || "Error creando cuenta");
        return;
      }
      setCuenta(data.cuenta);
      await marcarPaso("conectar");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error de red");
    } finally {
      setCreando(false);
    }
  }

  // El QR puede tardar unos segundos en aparecer post-creación.
  const tieneQr = !!cuenta?.qr_png || !!cuenta?.cadena_qr;
  const qrSrc = cuenta?.qr_png ?? null;

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-6 sm:py-14">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-400/80">
        01 — Conexión
      </p>
      <h1 className="font-display mt-2 text-3xl italic leading-tight tracking-tight sm:text-5xl">
        Conectá tu WhatsApp
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/60 sm:text-base">
        Escaneá un QR con tu teléfono y la IA empieza a recibir mensajes en
        tu número. Es la base — sin esto el agente no puede responder a
        nadie.
      </p>

      {!cuenta ? (
        <form
          onSubmit={crear}
          className="mt-10 flex flex-col gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6"
        >
          <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">
            Nombre del negocio
          </label>
          <input
            type="text"
            value={etiqueta}
            onChange={(e) => setEtiqueta(e.target.value)}
            placeholder="Mi Inmobiliaria"
            autoFocus
            className="rounded-xl border border-white/10 bg-black px-4 py-3.5 text-base text-white placeholder-white/30 focus:border-emerald-400/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
          />
          <button
            type="submit"
            disabled={!etiqueta.trim() || creando}
            className="mt-2 w-full rounded-full bg-emerald-400 px-6 py-3.5 text-base font-semibold text-black shadow-lg shadow-emerald-500/30 transition-all hover:bg-emerald-300 disabled:opacity-50 sm:w-auto"
          >
            {creando ? "Creando…" : "Crear cuenta y generar QR"}
          </button>
        </form>
      ) : cuenta.estado === "conectado" ? (
        <div className="mt-10 rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.06] p-6">
          <p className="font-display text-2xl italic text-emerald-300">
            ¡Listo! Conectado
          </p>
          <p className="mt-2 text-sm text-white/70">
            Avanzando al siguiente paso…
          </p>
        </div>
      ) : (
        <div className="mt-10 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">
            Cuenta · {cuenta.etiqueta}
          </p>

          {tieneQr && qrSrc ? (
            <div className="mt-4 flex flex-col items-center gap-5">
              <img
                src={qrSrc}
                alt="Código QR para conectar WhatsApp"
                width={280}
                height={280}
                className="rounded-2xl border border-white/10 bg-white p-3"
              />
              <ol className="max-w-md space-y-2 text-sm text-white/70">
                <li>
                  <span className="font-mono text-emerald-400">1.</span> Abrí
                  WhatsApp en tu teléfono.
                </li>
                <li>
                  <span className="font-mono text-emerald-400">2.</span> Andá
                  a{" "}
                  <span className="font-medium text-white/90">
                    Configuración → Dispositivos vinculados → Vincular un
                    dispositivo
                  </span>
                  .
                </li>
                <li>
                  <span className="font-mono text-emerald-400">3.</span>{" "}
                  Apuntá la cámara al QR de arriba.
                </li>
              </ol>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                Esperando escaneo…
              </p>
            </div>
          ) : (
            <div className="mt-4 flex flex-col items-center gap-4 py-10">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-emerald-400" />
              <p className="text-sm text-white/60">Generando QR…</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

async function marcarPaso(paso: string) {
  try {
    await fetch("/api/onboarding/paso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paso }),
    });
  } catch {
    /* no bloquea el flujo */
  }
}
