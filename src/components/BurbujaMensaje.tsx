import type { Mensaje } from "@/lib/baseDatos";

interface Props {
  mensaje: Mensaje;
  idCuenta: string;
}

function formatearHora(iso: string): string {
  const fecha = new Date(iso);
  return fecha.toLocaleTimeString("es", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function urlMedia(idCuenta: string, mediaPath: string): string {
  // Prefijo "biblio:" indica que el archivo está en data/biblioteca/, no en data/media/.
  // Lo enviamos a través del endpoint /api/biblioteca/[idCuenta]/[archivo].
  if (mediaPath.startsWith("biblio:")) {
    const sinPrefijo = mediaPath.slice("biblio:".length);
    const archivo = sinPrefijo.includes("/")
      ? sinPrefijo.split("/").slice(1).join("/")
      : sinPrefijo;
    return `/api/biblioteca/${idCuenta}/${archivo}`;
  }
  const archivo = mediaPath.includes("/")
    ? mediaPath.split("/").slice(1).join("/")
    : mediaPath;
  return `/api/media/${idCuenta}/${archivo}`;
}

/** Filtra marcadores internos como "[imagen sin descripción]" */
function captionVisible(mensaje: Mensaje): string {
  const c = mensaje.contenido?.trim() ?? "";
  if (!c) return "";
  if (c.startsWith("[") && c.endsWith("]")) return "";
  return c;
}

export function BurbujaMensaje({ mensaje, idCuenta }: Props) {
  // Mensaje de sistema (handoff, etc) — burbuja centrada distintiva
  if (mensaje.rol === "sistema" || mensaje.tipo === "sistema") {
    return (
      <div className="flex justify-center animate-aparecer">
        <div className="max-w-[80%] rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-center text-xs text-amber-800 dark:text-amber-200">
          {mensaje.contenido}
        </div>
      </div>
    );
  }

  const esUsuario = mensaje.rol === "usuario";
  const esHumano = mensaje.rol === "humano";

  const lado = esUsuario ? "justify-start" : "justify-end";
  const radio = esUsuario ? "rounded-bl-md" : "rounded-br-md";
  const colores = esUsuario
    ? "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/80"
    : esHumano
    ? "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100"
    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100";
  const colorTextoTenue = esUsuario
    ? "text-zinc-400 dark:text-zinc-600"
    : esHumano
    ? "text-amber-700/70 dark:text-amber-300/60"
    : "text-emerald-700/70 dark:text-emerald-300/60";

  const hora = formatearHora(mensaje.creado_en);

  // ============================================================
  // AUDIO
  // ============================================================
  if (mensaje.tipo === "audio") {
    const transcripcion = captionVisible(mensaje);
    const src = mensaje.media_path
      ? urlMedia(idCuenta, mensaje.media_path)
      : null;
    return (
      <div className={`flex ${lado} animate-aparecer`}>
        <div
          className={`max-w-[78%] rounded-2xl ${radio} border px-4 py-3 shadow-sm backdrop-blur-sm ${colores}`}
        >
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider opacity-80">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
            >
              <path d="M12 2v4" />
              <path d="M12 18v4" />
              <rect x="9" y="6" width="6" height="12" rx="3" />
            </svg>
            Audio transcrito
          </div>
          {transcripcion && (
            <p className="mb-2 italic whitespace-pre-wrap break-words text-sm leading-relaxed opacity-90">
              &ldquo;{transcripcion}&rdquo;
            </p>
          )}
          {src ? (
            <audio src={src} controls className="h-9 w-full max-w-[280px]" />
          ) : (
            <p className="text-xs italic opacity-60">[audio no disponible]</p>
          )}
          <p
            className={`mt-2 text-[10px] font-medium uppercase tracking-wider ${colorTextoTenue}`}
          >
            {hora}
          </p>
        </div>
      </div>
    );
  }

  // ============================================================
  // IMAGEN / VIDEO / DOCUMENTO
  // ============================================================
  const esMedia =
    mensaje.tipo === "imagen" ||
    mensaje.tipo === "video" ||
    mensaje.tipo === "documento";

  if (esMedia && mensaje.media_path) {
    const src = urlMedia(idCuenta, mensaje.media_path);
    const caption = captionVisible(mensaje);

    // Documento: una sola burbuja con icono + nombre del archivo
    if (mensaje.tipo === "documento") {
      return (
        <div className={`flex ${lado} animate-aparecer`}>
          <div
            className={`max-w-[78%] rounded-2xl ${radio} border px-4 py-3 shadow-sm backdrop-blur-sm ${colores}`}
          >
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-sm underline"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4 shrink-0"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              {caption || "Descargar documento"}
            </a>
            <p
              className={`mt-2 text-[10px] font-medium uppercase tracking-wider ${colorTextoTenue} ${esUsuario ? "" : "text-right"}`}
            >
              {hora}
            </p>
          </div>
        </div>
      );
    }

    // Imagen / Video: burbuja con SOLO la media (hora overlay si no hay caption)
    // + burbuja separada debajo con el caption (si existe)
    return (
      <div className="flex flex-col gap-1 animate-aparecer">
        <div className={`flex ${lado}`}>
          <div
            className={`relative overflow-hidden rounded-2xl ${radio} border shadow-sm ${colores}`}
          >
            {mensaje.tipo === "imagen" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={caption || "Imagen"}
                className="block max-h-[320px] w-auto"
              />
            ) : (
              <video
                src={src}
                controls
                className="block max-h-[320px] w-auto"
              />
            )}
            {/* Hora como overlay solo si NO hay caption (ahí va en la burbuja de abajo) */}
            {!caption && (
              <span className="pointer-events-none absolute bottom-1.5 right-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                {hora}
              </span>
            )}
          </div>
        </div>
        {caption && (
          <div className={`flex ${lado}`}>
            <div
              className={`max-w-[78%] rounded-2xl ${radio} border px-4 py-2.5 shadow-sm backdrop-blur-sm ${colores}`}
            >
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                {caption}
              </p>
              <p
                className={`mt-1 text-[10px] font-medium uppercase tracking-wider ${colorTextoTenue} ${esUsuario ? "" : "text-right"}`}
              >
                {hora}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================================
  // TEXTO normal
  // ============================================================
  return (
    <div className={`flex ${lado} animate-aparecer`}>
      <div
        className={`max-w-[78%] rounded-2xl ${radio} border px-4 py-2.5 shadow-sm backdrop-blur-sm ${colores}`}
      >
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {mensaje.contenido}
        </p>
        <p
          className={`mt-1 text-[10px] font-medium uppercase tracking-wider ${colorTextoTenue} ${esUsuario ? "" : "text-right"}`}
        >
          {hora}
        </p>
      </div>
    </div>
  );
}
