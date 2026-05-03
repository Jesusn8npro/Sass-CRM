"use client";

import type { RefObject } from "react";

export function PanelUploadsProducto({
  urlImagen,
  urlVideo,
  imagenPendiente,
  videoPendiente,
  refInputImagen,
  refInputVideo,
  guardando,
  elegirImagen,
  elegirVideo,
  quitarImagen,
  quitarVideo,
}: {
  urlImagen: string | null;
  urlVideo: string | null;
  imagenPendiente: File | null;
  videoPendiente: File | null;
  refInputImagen: RefObject<HTMLInputElement | null>;
  refInputVideo: RefObject<HTMLInputElement | null>;
  guardando: boolean;
  elegirImagen: (f: File) => void;
  elegirVideo: (f: File) => void;
  quitarImagen: () => void;
  quitarVideo: () => void;
}) {
  return (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Imagen */}
            <div className="rounded-xl border border-dashed border-zinc-200 p-3 dark:border-zinc-800">
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Imagen
              </label>
              <div
                className="relative aspect-video overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800"
              >
                {urlImagen ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={urlImagen} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-zinc-400">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  </div>
                )}
                {imagenPendiente && (
                  <span className="absolute bottom-1 left-1 rounded bg-amber-500/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white">
                    Pendiente
                  </span>
                )}
              </div>
              <input
                ref={refInputImagen}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) elegirImagen(f);
                }}
                className="hidden"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => refInputImagen.current?.click()}
                  disabled={guardando}
                  className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                >
                  {urlImagen ? "Cambiar" : "Elegir imagen"}
                </button>
                {urlImagen && (
                  <button
                    type="button"
                    onClick={quitarImagen}
                    className="text-[11px] text-red-600 hover:underline dark:text-red-400"
                  >
                    Quitar
                  </button>
                )}
              </div>
              <p className="mt-1 text-[10px] text-zinc-500">
                JPG / PNG / WebP, máx 8MB.
              </p>
            </div>

            {/* Video */}
            <div className="rounded-xl border border-dashed border-zinc-200 p-3 dark:border-zinc-800">
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Video (opcional)
              </label>
              <div className="relative aspect-video overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                {urlVideo ? (
                  <video
                    key={urlVideo}
                    src={urlVideo}
                    controls
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-zinc-400">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8">
                      <polygon points="23 7 16 12 23 17 23 7" />
                      <rect x="1" y="5" width="15" height="14" rx="2" />
                    </svg>
                  </div>
                )}
                {videoPendiente && (
                  <span className="absolute bottom-1 left-1 rounded bg-amber-500/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white">
                    Pendiente
                  </span>
                )}
              </div>
              <input
                ref={refInputVideo}
                type="file"
                accept="video/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) elegirVideo(f);
                }}
                className="hidden"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => refInputVideo.current?.click()}
                  disabled={guardando}
                  className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                >
                  {urlVideo ? "Cambiar" : "Elegir video"}
                </button>
                {urlVideo && (
                  <button
                    type="button"
                    onClick={quitarVideo}
                    className="text-[11px] text-red-600 hover:underline dark:text-red-400"
                  >
                    Quitar
                  </button>
                )}
              </div>
              <p className="mt-1 text-[10px] text-zinc-500">
                MP4 / WebM / MOV, máx 50MB.
              </p>
            </div>
          </div>
  );
}
