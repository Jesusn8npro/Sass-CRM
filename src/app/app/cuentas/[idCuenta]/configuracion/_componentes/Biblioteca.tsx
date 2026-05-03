"use client";

import { useEffect, useRef, useState } from "react";
import type { MedioBiblioteca } from "@/lib/baseDatos";
import { Tarjeta, inputClases, textareaClases } from "./compartido";

export function SeccionBiblioteca({
  idCuenta,
  medios,
  onCambio,
}: {
  idCuenta: string;
  medios: MedioBiblioteca[];
  onCambio: () => void;
}) {
  const [identificador, setIdentificador] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refInput = useRef<HTMLInputElement>(null);

  async function subir(e: React.FormEvent) {
    e.preventDefault();
    if (!archivo || !identificador.trim() || !descripcion.trim() || subiendo)
      return;
    setSubiendo(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("archivo", archivo);
      formData.append("identificador", identificador.trim());
      formData.append("descripcion", descripcion.trim());
      const res = await fetch(`/api/cuentas/${idCuenta}/biblioteca`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? `Error HTTP ${res.status}`);
        return;
      }
      setIdentificador("");
      setDescripcion("");
      setArchivo(null);
      if (refInput.current) refInput.current.value = "";
      onCambio();
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <Tarjeta
      titulo="Biblioteca de medios"
      descripcion="Subí imágenes, videos, audios o PDFs que la IA pueda enviar al cliente cuando convenga (catálogos, demos, garantías, etc). El agente decide cuándo enviar cada uno usando la descripción que pongas acá."
    >
      {medios.length > 0 && (
        <ul className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2">
          {medios.map((m) => (
            <MedioBibliotecaItem
              key={m.id}
              idCuenta={idCuenta}
              medio={m}
              onCambio={onCambio}
            />
          ))}
        </ul>
      )}

      <form
        onSubmit={subir}
        className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-900/40"
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Subir nuevo medio
        </p>
        <input
          type="text"
          value={identificador}
          onChange={(e) => setIdentificador(e.target.value)}
          placeholder='Identificador (ej: "catalogo_2025", "demo_acordeon")'
          maxLength={40}
          className={`${inputClases()} mb-3 font-mono`}
        />
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={3}
          placeholder="Descripción para que la IA decida cuándo enviarlo. Ej: 'Catálogo completo de acordeones 2025 con precios. Enviar cuando el cliente pregunta por modelos disponibles.'"
          className={`${textareaClases()} mb-3`}
        />
        <input
          ref={refInput}
          type="file"
          accept="image/*,video/*,audio/*,application/pdf"
          onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
          className="mb-3 block w-full text-xs text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-zinc-700 hover:file:bg-zinc-200 dark:text-zinc-400 dark:file:bg-zinc-800 dark:file:text-zinc-300"
        />
        {archivo && (
          <p className="mb-3 text-xs text-zinc-500">
            {archivo.name} —{" "}
            {(archivo.size / 1024 / 1024).toFixed(1)} MB
          </p>
        )}
        {error && (
          <p className="mb-2 text-xs text-red-700 dark:text-red-300">{error}</p>
        )}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={
              subiendo ||
              !archivo ||
              !identificador.trim() ||
              !descripcion.trim()
            }
            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {subiendo ? "Subiendo..." : "+ Subir medio"}
          </button>
        </div>
      </form>
    </Tarjeta>
  );
}

function MedioBibliotecaItem({
  idCuenta,
  medio,
  onCambio,
}: {
  idCuenta: string;
  medio: MedioBiblioteca;
  onCambio: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [descripcion, setDescripcion] = useState(medio.descripcion);
  const [guardando, setGuardando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [borrando, setBorrando] = useState(false);

  useEffect(() => {
    setDescripcion(medio.descripcion);
  }, [medio.id, medio.descripcion]);

  const archivo = medio.ruta_archivo.includes("/")
    ? medio.ruta_archivo.split("/").slice(1).join("/")
    : medio.ruta_archivo;
  const url = `/api/biblioteca/${idCuenta}/${archivo}`;

  async function guardar() {
    if (guardando) return;
    setGuardando(true);
    try {
      const res = await fetch(
        `/api/cuentas/${idCuenta}/biblioteca/${medio.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ descripcion }),
        },
      );
      if (res.ok) {
        setEditando(false);
        onCambio();
      }
    } finally {
      setGuardando(false);
    }
  }

  async function borrar() {
    if (borrando) return;
    setBorrando(true);
    try {
      const res = await fetch(
        `/api/cuentas/${idCuenta}/biblioteca/${medio.id}`,
        { method: "DELETE" },
      );
      if (res.ok) onCambio();
    } finally {
      setBorrando(false);
      setConfirmando(false);
    }
  }

  return (
    <li className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
      {/* Preview */}
      <div className="relative aspect-video bg-zinc-100 dark:bg-zinc-950">
        {medio.tipo === "imagen" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={medio.identificador}
            className="h-full w-full object-cover"
          />
        ) : medio.tipo === "video" ? (
          <video src={url} controls className="h-full w-full object-cover" />
        ) : medio.tipo === "audio" ? (
          <div className="flex h-full items-center justify-center p-3">
            <audio src={url} controls className="w-full" />
          </div>
        ) : (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="flex h-full items-center justify-center text-xs text-zinc-500 underline"
          >
            Abrir documento
          </a>
        )}
        <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium uppercase text-white">
          {medio.tipo}
        </span>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-2 p-3">
        <code className="font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
          {medio.identificador}
        </code>
        {editando ? (
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={3}
            className={textareaClases()}
          />
        ) : (
          <p className="line-clamp-3 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
            {medio.descripcion}
          </p>
        )}
        <div className="flex items-center justify-end gap-1">
          {editando ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setEditando(false);
                  setDescripcion(medio.descripcion);
                }}
                className="rounded-full px-2 py-1 text-[10px] text-zinc-500"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardar}
                disabled={guardando || !descripcion.trim()}
                className="rounded-full bg-emerald-500 px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-50"
              >
                {guardando ? "..." : "Guardar"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setEditando(true)}
                className="rounded-full px-2 py-1 text-[10px] text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                Editar descripción
              </button>
              {confirmando ? (
                <div className="flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 p-0.5">
                  <button
                    type="button"
                    onClick={() => setConfirmando(false)}
                    className="rounded-full px-2 py-0.5 text-[10px] text-zinc-600"
                  >
                    No
                  </button>
                  <button
                    type="button"
                    onClick={borrar}
                    disabled={borrando}
                    className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:text-red-300"
                  >
                    {borrando ? "..." : "Sí"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmando(true)}
                  className="rounded-full px-2 py-1 text-[10px] text-zinc-500 hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300"
                >
                  Borrar
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </li>
  );
}
