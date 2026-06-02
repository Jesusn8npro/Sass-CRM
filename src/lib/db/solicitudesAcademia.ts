/**
 * Solicitudes de seguimiento provenientes de Academia Vallenata Online.
 * Llegan por webhook (lead del chat que dejó WhatsApp y no compró) y el admin
 * las dispara por WhatsApp desde el panel.
 */
import { sql } from "./sql";

export interface SolicitudAcademia {
  id: string;
  evento: string | null;
  nombre: string | null;
  whatsapp: string;
  email: string | null;
  ciudad: string | null;
  que_quiere_aprender: string | null;
  nivel_acordeon: string | null;
  productos_consultados: string[] | null;
  nivel_interes: number | null;
  pagina_origen: string | null;
  mensaje_sugerido: string | null;
  payload: unknown;
  estado: "pendiente" | "enviado" | "descartado" | "error";
  error_envio: string | null;
  created_at: string;
  enviado_at: string | null;
}

export async function crearSolicitudAcademia(d: {
  evento?: string | null;
  nombre?: string | null;
  whatsapp: string;
  email?: string | null;
  ciudad?: string | null;
  que_quiere_aprender?: string | null;
  nivel_acordeon?: string | null;
  productos_consultados?: string[] | null;
  nivel_interes?: number | null;
  pagina_origen?: string | null;
  mensaje_sugerido?: string | null;
  payload?: unknown;
}): Promise<SolicitudAcademia> {
  const filas = await sql()<SolicitudAcademia[]>`
    insert into solicitudes_academia (
      evento, nombre, whatsapp, email, ciudad, que_quiere_aprender,
      nivel_acordeon, productos_consultados, nivel_interes, pagina_origen,
      mensaje_sugerido, payload
    ) values (
      ${d.evento ?? null}, ${d.nombre ?? null}, ${d.whatsapp}, ${d.email ?? null},
      ${d.ciudad ?? null}, ${d.que_quiere_aprender ?? null}, ${d.nivel_acordeon ?? null},
      ${JSON.stringify(d.productos_consultados ?? [])}::jsonb, ${d.nivel_interes ?? null},
      ${d.pagina_origen ?? null}, ${d.mensaje_sugerido ?? null},
      ${JSON.stringify(d.payload ?? {})}::jsonb
    )
    returning *
  `;
  return filas[0];
}

export async function listarSolicitudesAcademia(estado?: string): Promise<SolicitudAcademia[]> {
  if (estado) {
    return await sql()<SolicitudAcademia[]>`
      select * from solicitudes_academia where estado = ${estado}
      order by created_at desc limit 200`;
  }
  return await sql()<SolicitudAcademia[]>`
    select * from solicitudes_academia order by created_at desc limit 200`;
}

export async function obtenerSolicitudAcademia(id: string): Promise<SolicitudAcademia | null> {
  const filas = await sql()<SolicitudAcademia[]>`select * from solicitudes_academia where id = ${id}`;
  return filas[0] ?? null;
}

export async function marcarSolicitudAcademia(
  id: string,
  estado: "enviado" | "descartado" | "error",
  errorEnvio?: string | null,
): Promise<void> {
  await sql()`
    update solicitudes_academia
    set estado = ${estado},
        error_envio = ${errorEnvio ?? null},
        enviado_at = ${estado === "enviado" ? new Date().toISOString() : null}
    where id = ${id}`;
}
