/**
 * Renderer de Markdown server-side, sin librerías externas.
 *
 * Soporta el subset que necesitan los artículos:
 *  - Encabezados h1-h4
 *  - Párrafos
 *  - **bold** y *italic*
 *  - [texto](url)
 *  - Listas - / 1.
 *  - > blockquote
 *  - `código inline`
 *  - ```code blocks```
 *  - Reglas horizontales: ---
 *
 * NO soporta tablas ni embeds — por ahora no se necesitan. Si en el
 * futuro hacen falta, conviene cambiar a `remark` + `rehype-stringify`
 * (paquetes ya conocidos en Next ecosystem).
 *
 * Output: React elements (server-component compatible).
 */
import { Fragment, type ReactNode } from "react";

// ============================================================
// Sanitización HTML mínima — escapamos los <> de strings textuales
// para evitar XSS si la IA pone HTML en el markdown.
// ============================================================
function escapar(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ============================================================
// Render inline (dentro de un párrafo o item de lista)
// ============================================================
function renderInline(texto: string, key: string): ReactNode[] {
  // Procesamos: **bold**, *italic*, `code`, [link](url) en pasadas
  // sucesivas. Para no complicar, hacemos un parser regex con tokens.
  const tokens: Array<{ tipo: string; valor: string; href?: string }> = [];
  let resto = texto;
  // Regex combinada con grupos nombrados, en orden de prioridad
  const PATRON =
    /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/;
  let match = PATRON.exec(resto);
  while (match) {
    if (match.index > 0) {
      tokens.push({ tipo: "text", valor: resto.slice(0, match.index) });
    }
    const m = match[0];
    if (m.startsWith("`")) {
      tokens.push({ tipo: "code", valor: m.slice(1, -1) });
    } else if (m.startsWith("**")) {
      tokens.push({ tipo: "bold", valor: m.slice(2, -2) });
    } else if (m.startsWith("*")) {
      tokens.push({ tipo: "italic", valor: m.slice(1, -1) });
    } else if (m.startsWith("[")) {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(m);
      if (linkMatch) {
        tokens.push({
          tipo: "link",
          valor: linkMatch[1] ?? "",
          href: linkMatch[2] ?? "#",
        });
      } else {
        tokens.push({ tipo: "text", valor: m });
      }
    }
    resto = resto.slice(match.index + m.length);
    match = PATRON.exec(resto);
  }
  if (resto.length > 0) tokens.push({ tipo: "text", valor: resto });

  return tokens.map((t, i) => {
    const k = `${key}-${i}`;
    if (t.tipo === "code")
      return (
        <code
          key={k}
          className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-[0.9em]"
        >
          {t.valor}
        </code>
      );
    if (t.tipo === "bold")
      return (
        <strong key={k} className="font-semibold">
          {t.valor}
        </strong>
      );
    if (t.tipo === "italic")
      return (
        <em key={k} className="italic">
          {t.valor}
        </em>
      );
    if (t.tipo === "link") {
      const esExterno = (t.href ?? "").startsWith("http");
      return (
        <a
          key={k}
          href={t.href}
          className="text-emerald-600 hover:text-emerald-700 underline underline-offset-2"
          {...(esExterno
            ? { target: "_blank", rel: "noopener noreferrer nofollow" }
            : {})}
        >
          {t.valor}
        </a>
      );
    }
    // text plano
    return <Fragment key={k}>{t.valor}</Fragment>;
  });
}

// ============================================================
// Render por bloque
// ============================================================
export function RenderMarkdown({ md }: { md: string }): ReactNode {
  // Normalizar saltos de línea
  const lineas = md.replace(/\r\n/g, "\n").split("\n");
  const bloques: ReactNode[] = [];
  let i = 0;
  let claveBloque = 0;

  while (i < lineas.length) {
    const linea = lineas[i] ?? "";
    const k = `b-${claveBloque++}`;

    // Code block ``` ... ```
    if (linea.startsWith("```")) {
      const codigo: string[] = [];
      i++;
      while (i < lineas.length && !(lineas[i] ?? "").startsWith("```")) {
        codigo.push(lineas[i] ?? "");
        i++;
      }
      i++; // saltar el cierre ```
      bloques.push(
        <pre
          key={k}
          className="my-4 p-4 rounded-lg bg-zinc-900 text-zinc-100 overflow-x-auto text-sm"
        >
          <code className="font-mono">{escapar(codigo.join("\n"))}</code>
        </pre>,
      );
      continue;
    }

    // Encabezados
    const h = /^(#{1,4})\s+(.+)$/.exec(linea);
    if (h) {
      const nivel = (h[1] ?? "").length;
      const texto = h[2] ?? "";
      const cls =
        nivel === 1
          ? "text-4xl font-bold mt-8 mb-4"
          : nivel === 2
            ? "text-3xl font-bold mt-8 mb-3"
            : nivel === 3
              ? "text-2xl font-semibold mt-6 mb-2"
              : "text-xl font-semibold mt-5 mb-2";
      const Tag = `h${nivel}` as "h1" | "h2" | "h3" | "h4";
      bloques.push(
        <Tag key={k} className={cls}>
          {renderInline(texto, k)}
        </Tag>,
      );
      i++;
      continue;
    }

    // Blockquote
    if (linea.startsWith("> ")) {
      const partes: string[] = [];
      while (i < lineas.length && (lineas[i] ?? "").startsWith("> ")) {
        partes.push((lineas[i] ?? "").slice(2));
        i++;
      }
      bloques.push(
        <blockquote
          key={k}
          className="my-4 pl-4 border-l-4 border-emerald-500 text-zinc-600 dark:text-zinc-400 italic"
        >
          {renderInline(partes.join(" "), k)}
        </blockquote>,
      );
      continue;
    }

    // Listas: detectar - / * / 1. al inicio
    const liMarker = /^(\s*)([-*]|\d+\.)\s+(.+)$/.exec(linea);
    if (liMarker) {
      const items: string[] = [];
      const esOrdenada = /^\d+\./.test((liMarker[2] ?? "").trim());
      while (i < lineas.length) {
        const m = /^(\s*)([-*]|\d+\.)\s+(.+)$/.exec(lineas[i] ?? "");
        if (!m) break;
        items.push(m[3] ?? "");
        i++;
      }
      const ListTag = esOrdenada ? "ol" : "ul";
      bloques.push(
        <ListTag
          key={k}
          className={`my-4 pl-6 space-y-1 ${esOrdenada ? "list-decimal" : "list-disc"}`}
        >
          {items.map((it, idx) => (
            <li key={`${k}-${idx}`}>{renderInline(it, `${k}-${idx}`)}</li>
          ))}
        </ListTag>,
      );
      continue;
    }

    // Regla horizontal
    if (/^-{3,}$/.test(linea.trim())) {
      bloques.push(<hr key={k} className="my-8 border-zinc-200 dark:border-zinc-800" />);
      i++;
      continue;
    }

    // Línea vacía: separador, skip
    if (linea.trim() === "") {
      i++;
      continue;
    }

    // Párrafo: agarrar líneas hasta un blank
    const partesP: string[] = [linea];
    i++;
    while (i < lineas.length && (lineas[i] ?? "").trim() !== "") {
      const sig = lineas[i] ?? "";
      // Si la siguiente es encabezado/lista/quote/code, cortamos
      if (
        /^#{1,4}\s/.test(sig) ||
        /^(\s*)([-*]|\d+\.)\s/.test(sig) ||
        sig.startsWith("> ") ||
        sig.startsWith("```") ||
        /^-{3,}$/.test(sig.trim())
      )
        break;
      partesP.push(sig);
      i++;
    }
    bloques.push(
      <p key={k} className="my-4 leading-relaxed text-zinc-700 dark:text-zinc-300">
        {renderInline(partesP.join(" "), k)}
      </p>,
    );
  }

  return <>{bloques}</>;
}

/**
 * Helper: calcular tiempo de lectura (min) a partir del markdown.
 * Asume 220 palabras / min de lectura promedio.
 */
export function calcularTiempoLectura(md: string): number {
  const palabras = md.split(/\s+/).filter((p) => p.length > 0).length;
  return Math.max(1, Math.round(palabras / 220));
}
