/**
 * Formateo de los eventos de negocio a texto de WhatsApp para el operador.
 *
 * El webhook recibe `{ tipo, datos }` desde el sitio o la base del cliente y
 * acá lo volvemos un mensaje corto y accionable. La gracia es que el dueño
 * lea la alerta en el celular y sepa en dos segundos qué pasó y qué hacer.
 *
 * Los tipos conocidos tienen plantilla propia; cualquier otro cae en un
 * formato genérico que lista los datos recibidos. Así el cliente puede
 * inventar sus propios eventos sin que haya que tocar código acá.
 */

/** Etiquetas de los campos que más se repiten, para no mostrar `snake_case`. */
const ETIQUETAS: Record<string, string> = {
  nombre: "Nombre",
  apellido: "Apellido",
  email: "Email",
  correo: "Email",
  telefono: "Teléfono",
  whatsapp: "WhatsApp",
  producto: "Producto",
  nombre_producto: "Producto",
  valor: "Valor",
  monto: "Valor",
  precio: "Valor",
  metodo_pago: "Método de pago",
  como_nos_conocio: "Nos conoció por",
  ciudad: "Ciudad",
  pais: "País",
  estado: "Estado",
  referencia: "Referencia",
  ref_payco: "Referencia",
  cupon_codigo: "Cupón",
  url: "URL",
};

/** Campos que nunca se muestran: ruido técnico o datos sensibles. */
const CAMPOS_OCULTOS =
  /^(id|.*_id|user_agent|ip_cliente|created_at|updated_at|datos_adicionales|token)$/i;

/** Formatea un número como pesos colombianos. Si no es número, lo deja igual. */
function formatearValor(valor: unknown): string {
  const n = typeof valor === "number" ? valor : Number(String(valor).replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n) || n === 0) return String(valor ?? "");
  return "$" + Math.round(n).toLocaleString("es-CO");
}

function esCampoValor(clave: string): boolean {
  return /^(valor|monto|precio)$/i.test(clave);
}

/** Convierte los datos del evento en líneas "• Etiqueta: valor". */
function lineasDatos(datos: Record<string, unknown>): string[] {
  const lineas: string[] = [];
  for (const [clave, valor] of Object.entries(datos)) {
    if (valor === null || valor === undefined || valor === "") continue;
    if (CAMPOS_OCULTOS.test(clave)) continue;
    if (typeof valor === "object") continue;
    const etiqueta = ETIQUETAS[clave.toLowerCase()] ?? clave.replace(/_/g, " ");
    const texto = esCampoValor(clave) ? formatearValor(valor) : String(valor);
    lineas.push(`• ${etiqueta}: ${texto.slice(0, 120)}`);
  }
  return lineas;
}

/** Nombre legible de la persona, si viene en los datos. */
function nombrePersona(datos: Record<string, unknown>): string {
  const nombre = String(datos.nombre ?? datos.name ?? "").trim();
  const apellido = String(datos.apellido ?? "").trim();
  const completo = [nombre, apellido].filter(Boolean).join(" ");
  return completo || String(datos.email ?? datos.correo ?? "").trim() || "Alguien";
}

/** Encabezado (emoji + título) por tipo de evento. */
function encabezado(tipo: string, datos: Record<string, unknown>): string {
  const quien = nombrePersona(datos);
  const producto = String(datos.producto ?? datos.nombre_producto ?? "").trim();
  switch (tipo) {
    case "usuario_registrado":
      return `🆕 Nuevo registro en la academia\n${quien} acaba de crear su cuenta.`;
    case "compra_iniciada":
    case "pago_pendiente":
      return (
        `🛒 Intento de compra SIN COMPLETAR\n` +
        `${quien} inició el pago${producto ? ` de "${producto}"` : ""} y quedó pendiente.\n` +
        `Escribile ya: es el lead más caliente que vas a tener hoy.`
      );
    case "compra_confirmada":
    case "pago_aceptado":
      return `✅ ¡VENTA CONFIRMADA!\n${quien} compró${producto ? ` "${producto}"` : ""}.`;
    case "compra_rechazada":
    case "pago_rechazado":
      return (
        `❌ Pago rechazado\n` +
        `A ${quien} le rebotó el pago${producto ? ` de "${producto}"` : ""}.\n` +
        `Ofrecele otro medio de pago antes de que se enfríe.`
      );
    case "clase_reservada":
      return `📅 Clase personalizada reservada\n${quien} reservó una clase.`;
    default:
      return `🔔 ${tipo.replace(/_/g, " ")}`;
  }
}

/**
 * Arma el mensaje completo para el operador. `titulo` permite que quien manda
 * el evento sobreescriba el encabezado sin depender de los tipos conocidos.
 */
export function formatearEventoParaOperador(parametros: {
  tipo: string;
  titulo?: string | null;
  datos: Record<string, unknown>;
}): string {
  const { tipo, titulo, datos } = parametros;
  const cabecera = titulo?.trim() ? `🔔 ${titulo.trim()}` : encabezado(tipo, datos);
  const detalle = lineasDatos(datos);
  return detalle.length > 0 ? `${cabecera}\n\n${detalle.join("\n")}` : cabecera;
}
