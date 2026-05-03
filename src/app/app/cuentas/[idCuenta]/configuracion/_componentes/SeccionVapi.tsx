"use client";

import { useEffect, useState } from "react";
import {
  Etiqueta,
  MensajeEstado,
  PropsSeccionBase,
  Tarjeta,
  botonGuardar,
  inputClases,
  patchCuenta,
} from "./compartido";

import { ConfigAvanzadaVapi, EstadoSincronizarVapi } from "./_seccionVapi-extras";
export function SeccionVapi({ cuenta, onActualizada }: PropsSeccionBase) {
  const [apiKey, setApiKey] = useState(cuenta.vapi_api_key ?? "");
  const [publicKey, setPublicKey] = useState(cuenta.vapi_public_key ?? "");
  const [phoneId, setPhoneId] = useState(cuenta.vapi_phone_id ?? "");
  const [promptExtra, setPromptExtra] = useState(
    cuenta.vapi_prompt_extra ?? "",
  );
  const [primerMensaje, setPrimerMensaje] = useState(
    cuenta.vapi_primer_mensaje ?? "",
  );
  const [maxSegundos, setMaxSegundos] = useState<number>(
    cuenta.vapi_max_segundos ?? 600,
  );
  const [grabar, setGrabar] = useState<boolean>(!!cuenta.vapi_grabar);
  const [avanzadoAbierto, setAvanzadoAbierto] = useState(false);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  const [phones, setPhones] = useState<
    Array<{ id: string; number?: string; name?: string }>
  >([]);
  const [cargandoPhones, setCargandoPhones] = useState(false);
  const [errorPhones, setErrorPhones] = useState<string | null>(null);

  const [sincronizando, setSincronizando] = useState(false);
  const [resultadoSync, setResultadoSync] = useState<string | null>(null);

  const [telTest, setTelTest] = useState("");
  const [llamandoTest, setLlamandoTest] = useState(false);
  const [resultadoTest, setResultadoTest] = useState<string | null>(null);

  useEffect(() => {
    setApiKey(cuenta.vapi_api_key ?? "");
    setPublicKey(cuenta.vapi_public_key ?? "");
    setPhoneId(cuenta.vapi_phone_id ?? "");
    setPromptExtra(cuenta.vapi_prompt_extra ?? "");
    setPrimerMensaje(cuenta.vapi_primer_mensaje ?? "");
    setMaxSegundos(cuenta.vapi_max_segundos ?? 600);
    setGrabar(!!cuenta.vapi_grabar);
    setError(null);
    setExito(false);
    setResultadoSync(null);
    setResultadoTest(null);
    setPhones([]);
  }, [cuenta.id]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (guardando) return;
    setGuardando(true);
    setError(null);
    setExito(false);
    const r = await patchCuenta(cuenta.id, {
      vapi_api_key: apiKey.trim() || null,
      vapi_public_key: publicKey.trim() || null,
      vapi_phone_id: phoneId.trim() || null,
      vapi_prompt_extra: promptExtra.trim() || null,
      vapi_primer_mensaje: primerMensaje.trim() || null,
      vapi_max_segundos: maxSegundos,
      vapi_grabar: grabar,
    });
    if ("error" in r) setError(r.error);
    else {
      onActualizada(r);
      setExito(true);
      setTimeout(() => setExito(false), 2500);
    }
    setGuardando(false);
  }

  async function llamadaPrueba() {
    if (llamandoTest) return;
    const tel = telTest.replace(/[^\d]/g, "");
    if (tel.length < 8 || tel.length > 15) {
      setResultadoTest(
        "✗ Número inválido — incluí código de país (ej: 5491123456789)",
      );
      return;
    }
    setLlamandoTest(true);
    setResultadoTest(null);
    try {
      const res = await fetch(`/api/cuentas/${cuenta.id}/vapi/test-call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefono: tel }),
      });
      const data = (await res.json().catch(() => ({}))) as
        | { llamada: { vapi_call_id: string } }
        | { error: string };
      if (res.ok && "llamada" in data) {
        setResultadoTest(
          `✓ Llamada disparada (id ${data.llamada.vapi_call_id.slice(0, 10)}…). Tu teléfono debería sonar en segundos.`,
        );
      } else {
        setResultadoTest(
          "✗ " + (("error" in data && data.error) || `HTTP ${res.status}`),
        );
      }
    } catch (err) {
      setResultadoTest(
        "✗ " + (err instanceof Error ? err.message : "Error de red"),
      );
    } finally {
      setLlamandoTest(false);
    }
  }

  async function cargarPhones() {
    if (cargandoPhones) return;
    setCargandoPhones(true);
    setErrorPhones(null);
    try {
      const res = await fetch(`/api/cuentas/${cuenta.id}/vapi/phones`, {
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as
        | { phones: typeof phones }
        | { error: string };
      if (res.ok && "phones" in data) {
        setPhones(data.phones);
      } else {
        setErrorPhones(
          ("error" in data && data.error) || `Error HTTP ${res.status}`,
        );
      }
    } catch (err) {
      setErrorPhones(err instanceof Error ? err.message : "Error de red");
    } finally {
      setCargandoPhones(false);
    }
  }

  async function sincronizar() {
    if (sincronizando) return;
    setSincronizando(true);
    setResultadoSync(null);
    try {
      const res = await fetch(
        `/api/cuentas/${cuenta.id}/vapi/sincronizar`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => ({}))) as
        | {
            ok: true;
            creado: boolean;
            assistant_id: string;
            webhook_url: string;
          }
        | { error: string };
      if (res.ok && "ok" in data) {
        setResultadoSync(
          `${data.creado ? "✓ Assistant creado" : "✓ Assistant actualizado"} (id: ${data.assistant_id.slice(0, 12)}...). Webhook: ${data.webhook_url}`,
        );
        // Recargar cuenta para que aparezca el assistant_id
        const c = await fetch(`/api/cuentas/${cuenta.id}`, {
          cache: "no-store",
        });
        if (c.ok) {
          const d = (await c.json()) as { cuenta: typeof cuenta };
          onActualizada(d.cuenta);
        }
      } else {
        setResultadoSync(
          "✗ " + (("error" in data && data.error) || `HTTP ${res.status}`),
        );
      }
    } finally {
      setSincronizando(false);
    }
  }

  // Estado efectivo Vapi (cuenta + fallback al .env del sistema).
  // Lo consultamos al server para no tener que exponer la lógica de fallback acá.
  const [estadoVapi, setEstadoVapi] = useState<{
    publicKey: string | null;
    phoneNumberId: string | null;
    configurado: boolean;
    origenes: {
      api_key: "cuenta" | "env" | "ninguno";
      public_key: "cuenta" | "env" | "ninguno";
      phone_id: "cuenta" | "env" | "ninguno";
    };
  } | null>(null);

  useEffect(() => {
    fetch(`/api/cuentas/${cuenta.id}/vapi/estado`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setEstadoVapi(d))
      .catch(() => {});
  }, [cuenta.id, exito]);

  // tieneApiKey/tienePhone consideran TANTO cuenta como fallback al .env
  const tieneApiKey = estadoVapi?.origenes.api_key !== "ninguno";
  const tienePhone = estadoVapi?.origenes.phone_id !== "ninguno";
  const tieneAssistant = !!cuenta.vapi_assistant_id?.trim();
  const tieneVoz = !!cuenta.voz_elevenlabs?.trim();
  const todoListo = tieneApiKey && tieneAssistant && tienePhone && tieneVoz;
  const usandoEnvKey = estadoVapi?.origenes.api_key === "env";
  const usandoEnvPhone = estadoVapi?.origenes.phone_id === "env";

  return (
    <Tarjeta
      titulo="Llamadas (Vapi)"
      descripcion="Llamadas de voz salientes con tu agente. Vapi orquesta Twilio + LLM + ElevenLabs. Por default usa las keys del sistema (.env). Solo pegá tus propias keys abajo si querés usar una cuenta de Vapi distinta a la del sistema."
    >
      {/* Banner: si todo viene del .env, mostramos OK y escondemos los inputs */}
      {(usandoEnvKey || usandoEnvPhone) && (
        <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-800 dark:text-emerald-200">
          ✓ <strong>Vapi listo</strong> — la API key y el Phone Number ID
          están configurados a nivel sistema ({" "}
          <code className="font-mono">.env</code>). No necesitás hacer nada
          acá: los assistants se crean automáticamente con esa cuenta de Vapi.
        </div>
      )}

      <form onSubmit={guardar} className="flex flex-col gap-4">
        {/* Inputs override — colapsados por default si todo está OK desde .env */}
        <details
          className="group rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40"
          {...(!(usandoEnvKey && usandoEnvPhone)
            ? { open: true }
            : {})}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            <span>
              {usandoEnvKey && usandoEnvPhone
                ? "Override per-cuenta (avanzado)"
                : "Configurar credenciales Vapi"}
            </span>
            <span className="text-zinc-400 transition-transform group-open:rotate-180">
              ▼
            </span>
          </summary>
          <p className="mt-2 mb-4 text-[11px] text-zinc-500">
            {usandoEnvKey && usandoEnvPhone
              ? "Solo abrí esto si querés que ESTA cuenta use otra cuenta de Vapi distinta a la del sistema. Los inputs vacíos = se usan los del sistema."
              : "Pegá las keys de tu cuenta Vapi para habilitar las llamadas."}
          </p>

          <div className="flex flex-col gap-4">
            <div>
              <Etiqueta>Vapi API Key (private/secret)</Etiqueta>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  usandoEnvKey
                    ? "(usando la del sistema)"
                    : "vapi_..."
                }
                className={`${inputClases()} font-mono text-xs`}
              />
              <p className="mt-1.5 text-[11px] text-zinc-500">
                Server-side. La obtenés en{" "}
                <a
                  href="https://dashboard.vapi.ai/account"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-700 underline dark:text-emerald-400"
                >
                  dashboard.vapi.ai/account
                </a>
                .
              </p>
            </div>

            <div>
              <Etiqueta>Vapi Public Key</Etiqueta>
              <input
                type="text"
                value={publicKey}
                onChange={(e) => setPublicKey(e.target.value)}
                placeholder={
                  estadoVapi?.origenes.public_key === "env"
                    ? "(usando la del sistema)"
                    : "sb_pub_... o UUID"
                }
                className={`${inputClases()} font-mono text-xs`}
              />
              <p className="mt-1.5 text-[11px] text-zinc-500">
                Necesaria para probar assistants con el micrófono desde el
                navegador (sin gastar minutos de outbound).
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Etiqueta>Phone Number ID</Etiqueta>
                <button
                  type="button"
                  onClick={cargarPhones}
                  disabled={(!apiKey.trim() && !tieneApiKey) || cargandoPhones}
                  className="text-[11px] text-emerald-700 underline disabled:opacity-50 dark:text-emerald-400"
                >
                  {cargandoPhones ? "Cargando..." : "Buscar mis números"}
                </button>
              </div>
              <input
                type="text"
                value={phoneId}
                onChange={(e) => setPhoneId(e.target.value)}
                placeholder={
                  usandoEnvPhone
                    ? "(usando el del sistema)"
                    : "phone_xxxxxxxx-xxxx-..."
                }
                className={`${inputClases()} font-mono text-xs`}
              />
          {phones.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {phones.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setPhoneId(p.id)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                    phoneId === p.id
                      ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                      : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                  }`}
                >
                  {p.name || p.number || p.id.slice(0, 8)}
                </button>
              ))}
            </div>
          )}
          {errorPhones && (
            <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">
              {errorPhones}
            </p>
          )}
          <p className="mt-1.5 text-[11px] text-zinc-500">
            En{" "}
            <a
              href="https://dashboard.vapi.ai/phone-numbers"
              target="_blank"
              rel="noreferrer"
              className="text-emerald-700 underline dark:text-emerald-400"
            >
              dashboard.vapi.ai/phone-numbers
            </a>{" "}
            podés comprar un número o importar uno de Twilio.
          </p>
            </div>
          </div>
        </details>

        <ConfigAvanzadaVapi
          cuenta={cuenta}
          avanzadoAbierto={avanzadoAbierto}
          setAvanzadoAbierto={setAvanzadoAbierto}
          promptExtra={promptExtra}
          setPromptExtra={setPromptExtra}
          primerMensaje={primerMensaje}
          setPrimerMensaje={setPrimerMensaje}
          maxSegundos={maxSegundos}
          setMaxSegundos={setMaxSegundos}
          grabar={grabar}
          setGrabar={setGrabar}
        />

        <EstadoSincronizarVapi
          cuenta={cuenta}
          estadoVapi={estadoVapi}
          tieneApiKey={tieneApiKey}
          tienePhone={tienePhone}
          tieneVoz={tieneVoz}
          tieneAssistant={tieneAssistant}
          todoListo={todoListo}
          sincronizar={sincronizar}
          sincronizando={sincronizando}
          resultadoSync={resultadoSync}
        />

        {/* Llamada de prueba */}
        {todoListo && (
          <div className="rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/5 p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              Prueba la llamada
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="tel"
                inputMode="numeric"
                value={telTest}
                onChange={(e) => setTelTest(e.target.value)}
                placeholder="Tu número con código país (ej: 5491123456789)"
                className={`${inputClases()} flex-1 font-mono text-xs`}
              />
              <button
                type="button"
                onClick={llamadaPrueba}
                disabled={llamandoTest || !telTest.trim()}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {llamandoTest ? "Llamando..." : "Llamar a este número"}
              </button>
            </div>
            {resultadoTest && (
              <p
                className={`mt-2 text-[11px] ${
                  resultadoTest.startsWith("✓")
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-red-700 dark:text-red-300"
                }`}
              >
                {resultadoTest}
              </p>
            )}
            <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">
              Tu teléfono va a sonar y el agente Vapi va a hablar con la
              voz, prompt y configuración que tenés. Cooldown de 1h por
              número entre llamadas.
            </p>
          </div>
        )}

        {!process.env.NEXT_PUBLIC_VAPI_PUBLIC_URL && (
          <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
            ⚠ Para que Vapi pueda mandar webhooks (transcripción + grabación)
            necesita una URL pública. En dev usá <code>ngrok</code> /{" "}
            <code>cloudflared</code> y poné <code>VAPI_PUBLIC_URL</code> en{" "}
            <code>.env.local</code>. En producción EasyPanel ya es público.
          </p>
        )}

        <div className="flex items-center justify-end gap-3">
          <MensajeEstado exito={exito} error={error} />
          {botonGuardar({ guardando })}
        </div>
      </form>
    </Tarjeta>
  );
}
