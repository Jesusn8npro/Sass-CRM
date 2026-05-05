/**
 * Operación server-only sobre plantillas: aplicar a una cuenta.
 * El catálogo (data + tipos) vive en `plantillasFunnel-data.ts` y se
 * re-exporta acá para preservar el API público histórico.
 */
import { crearEtapa, listarEtapas, type EtapaPipeline } from "./baseDatos";
import { PLANTILLAS_FUNNEL } from "./plantillasFunnel-data";

export type { PasoPlantilla, PlantillaFunnel } from "./plantillasFunnel-data";
export { PLANTILLAS_FUNNEL } from "./plantillasFunnel-data";

/** Aplica una plantilla a una cuenta — crea las N etapas de una vez.
 * Si la cuenta ya tiene etapas, las deja: solo agrega las nuevas con
 * orden incremental. Para empezar limpio, el dueño debería borrar
 * las etapas viejas antes desde la UI. */
export async function aplicarPlantillaFunnel(
  cuentaId: string,
  plantillaId: string,
): Promise<EtapaPipeline[]> {
  const plantilla = PLANTILLAS_FUNNEL.find((p) => p.id === plantillaId);
  if (!plantilla) {
    throw new Error(`Plantilla "${plantillaId}" no existe`);
  }

  const existentes = await listarEtapas(cuentaId);
  const idsExistentes = new Set(
    existentes.map((e) => e.paso_id).filter((p): p is string => !!p),
  );

  const creadas: EtapaPipeline[] = [];
  for (const paso of plantilla.pasos) {
    if (idsExistentes.has(paso.paso_id)) continue;
    const etapa = await crearEtapa(cuentaId, paso.nombre, paso.color, {
      paso_id: paso.paso_id,
      paso_siguiente_id: paso.paso_siguiente_id,
      criterio_transicion: paso.criterio_transicion,
      objetivos: paso.objetivos,
      descripcion: paso.descripcion,
    });
    creadas.push(etapa);
  }
  return await listarEtapas(cuentaId);
}
