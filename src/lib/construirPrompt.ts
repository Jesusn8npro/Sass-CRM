import type {
  Cuenta,
  EntradaConocimiento,
  MedioBiblioteca,
} from "./baseDatos";
import { PROMPT_SISTEMA_DEFAULT } from "./promptSistema";

/**
 * Combina los niveles de configuración del agente en un único system prompt:
 *
 * 1) Instrucciones base (tono, reglas, personaje): cuenta.prompt_sistema
 * 2) Texto libre del negocio: cuenta.contexto_negocio
 * 3) Entradas estructuradas (productos, FAQs, etc): conocimiento[]
 * 4) Biblioteca de medios disponibles que el agente puede enviar
 */
export function construirPromptSistema(
  cuenta: Cuenta,
  conocimiento: EntradaConocimiento[],
  biblioteca: MedioBiblioteca[] = [],
): string {
  const partes: string[] = [];

  const promptBase = cuenta.prompt_sistema?.trim();
  partes.push(promptBase || PROMPT_SISTEMA_DEFAULT);

  const contexto = cuenta.contexto_negocio?.trim();
  if (contexto) {
    partes.push("\n\n# Información del negocio\n\n" + contexto);
  }

  const entradasValidas = conocimiento.filter(
    (e) => e.titulo.trim() && e.contenido.trim(),
  );
  if (entradasValidas.length > 0) {
    partes.push("\n\n# Información clave de referencia\n");
    for (const e of entradasValidas) {
      partes.push(`\n## ${e.titulo.trim()}\n\n${e.contenido.trim()}\n`);
    }
  }

  if (biblioteca.length > 0) {
    partes.push(
      "\n\n# Medios disponibles para enviar\n\n" +
        "Tenés estos archivos pre-cargados que podés enviar al cliente cuando " +
        "convenga. Para enviarlos, agregá una parte con tipo='media' y media_id " +
        "exactamente igual al identificador. NO inventes identificadores.\n",
    );
    for (const m of biblioteca) {
      partes.push(
        `\n- **${m.identificador}** (${m.tipo}): ${m.descripcion.trim() || "(sin descripción)"}`,
      );
    }
    partes.push("\n");
  }

  return partes.join("");
}
