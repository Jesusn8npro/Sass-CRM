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
import { slugificar } from "./slug";

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
// Tabla de contenidos: extrae los headings h2/h3 del markdown
// con su texto plano y un slug único como anchor id.
// ============================================================
export interface ItemTOC {
  /** Texto plano del heading (sin formato markdown). */
  texto: string;
  /** Nivel: 2 = H2, 3 = H3. Solo extraemos esos dos niveles. */
  nivel: 2 | 3;
  /** Slug único para usar como id="" del heading y href="#slug". */
  slug: string;
}

/**
 * Extrae el TOC del markdown. Solo H2 y H3 (H4 sería demasiado
 * granular y ensuciaría el TOC). Garantiza slugs únicos sufijando
 * `-2`, `-3` si dos headings dan el mismo slug.
 */
export function extraerTabla(md: string): ItemTOC[] {
  const items: ItemTOC[] = [];
  const usados = new Map<string, number>();
  const lineas = md.replace(/\r\n/g, "\n").split("\n");
  let dentroDeCodeBlock = false;

  for (const linea of lineas) {
    if (linea.startsWith("```")) {
      dentroDeCodeBlock = !dentroDeCodeBlock;
      continue;
    }
    if (dentroDeCodeBlock) continue;

    const m = /^(#{2,3})\s+(.+)$/.exec(linea);
    if (!m) continue;
    const nivel = ((m[1] ?? "").length === 2 ? 2 : 3) as 2 | 3;
    const textoCrudo = (m[2] ?? "").trim();
    // Quitar marcadores inline (**, *, `, links) para texto limpio
    const textoLimpio = textoCrudo
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

    const slugBase = slugificar(textoLimpio);
    if (!slugBase) continue;

    let slugFinal = slugBase;
    const previas = usados.get(slugBase) ?? 0;
    if (previas > 0) slugFinal = `${slugBase}-${previas + 1}`;
    usados.set(slugBase, previas + 1);

    items.push({ texto: textoLimpio, nivel, slug: slugFinal });
  }

  return items;
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

  // Mapa de slugs usados para sincronizar con extraerTabla.
  // Misma lógica de dedup: 'mi-titulo', 'mi-titulo-2', 'mi-titulo-3'...
  // Crítico para que los <a href="#slug"> del TOC matcheen los <h2 id="slug">.
  const slugsUsados = new Map<string, number>();
  function slugUnicoParaHeading(textoLimpio: string): string {
    const base = slugificar(textoLimpio);
    if (!base) return "";
    const previas = slugsUsados.get(base) ?? 0;
    slugsUsados.set(base, previas + 1);
    return previas > 0 ? `${base}-${previas + 1}` : base;
  }

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
          ? "text-4xl font-bold mt-8 mb-4 scroll-mt-24"
          : nivel === 2
            ? "text-3xl font-bold mt-8 mb-3 scroll-mt-24"
            : nivel === 3
              ? "text-2xl font-semibold mt-6 mb-2 scroll-mt-24"
              : "text-xl font-semibold mt-5 mb-2 scroll-mt-24";
      const Tag = `h${nivel}` as "h1" | "h2" | "h3" | "h4";

      // Generar id solo para H2 y H3 (los que aparecen en el TOC).
      // scroll-mt-24 deja un offset cuando se navega vía anchor para que
      // el heading no quede pegado al top.
      let id: string | undefined;
      if (nivel === 2 || nivel === 3) {
        const textoLimpio = texto
          .replace(/`([^`]+)`/g, "$1")
          .replace(/\*\*([^*]+)\*\*/g, "$1")
          .replace(/\*([^*]+)\*/g, "$1")
          .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
        const slug = slugUnicoParaHeading(textoLimpio);
        if (slug) id = slug;
      }

      bloques.push(
        <Tag key={k} id={id} className={cls}>
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

    // Imagen inline ![alt](url) — usa <img> para tolerar cualquier host
    // (el AI puede generar URLs de Supabase, CDN externo o placeholders)
    const imgMatch = /^!\[(.*?)\]\(([^)]+)\)$/.exec(linea.trim());
    if (imgMatch) {
      const alt = imgMatch[1] ?? "";
      const src = imgMatch[2] ?? "";
      bloques.push(
        <div key={k} className="my-6 w-full overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="w-full h-auto object-cover"
            loading="lazy"
          />
        </div>,
      );
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

/**
 * Tabla de contenidos navegable. Server component puro — los anchors
 * funcionan con scroll-behavior smooth del HTML (declarado a nivel
 * global) y scroll-mt-24 que ya tienen los headings renderizados.
 *
 * Si la lista tiene <2 items, no renderiza nada — no hay nada para
 * navegar realmente.
 */
export function TablaContenidos({
  items,
}: {
  items: ItemTOC[];
}): ReactNode {
  if (items.length < 2) return null;

  return (
    <nav
      aria-label="Tabla de contenidos"
      className="my-8 rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
        // tabla de contenidos
      </p>
      <p className="mt-1 font-semibold text-zinc-900 dark:text-white">
        ¿Qué vas a leer?
      </p>
      <ol className="mt-3 space-y-1.5 text-sm">
        {items.map((it, idx) => (
          <li
            key={`toc-${it.slug}-${idx}`}
            className={it.nivel === 3 ? "ml-5" : ""}
          >
            <a
              href={`#${it.slug}`}
              className="inline-flex items-baseline gap-2 text-zinc-700 transition-colors hover:text-emerald-700 dark:text-zinc-300 dark:hover:text-emerald-400"
            >
              <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                {it.nivel === 2
                  ? String(
                      items
                        .slice(0, idx + 1)
                        .filter((x) => x.nivel === 2).length,
                    ).padStart(2, "0")
                  : "·"}
              </span>
              <span>{it.texto}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
