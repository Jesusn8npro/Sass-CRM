"use client";

import { useEffect, useRef, useState } from "react";

const CATEGORIAS: Record<string, string[]> = {
  Caras: [
    "😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃",
    "😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙",
    "🥲","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫",
    "🤔","🤐","🤨","😐","😑","😶","😏","😒","🙄","😬",
    "🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢",
    "🥵","🥶","🥴","😵","🤯","🤠","🥳","😎","🤓","🧐",
    "😕","😟","🙁","☹️","😮","😯","😲","😳","🥺","😦",
    "😧","😨","😰","😥","😢","😭","😱","😖","😣","😞",
    "😓","😩","😫","🥱","😤","😡","😠","🤬","😈","👿",
  ],
  Gestos: [
    "👋","🤚","🖐","✋","🖖","👌","🤌","🤏","✌️","🤞",
    "🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","👍",
    "👎","✊","👊","🤛","🤜","👏","🙌","👐","🤲","🤝",
    "🙏","✍️","💅","🤳","💪","🦾","🦵","🦶","👂","🦻",
    "👃","🧠","🫀","🫁","🦷","🦴","👀","👁","👅","👄",
  ],
  Corazones: [
    "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔",
    "❣️","💕","💞","💓","💗","💖","💘","💝","💟","♥️",
  ],
  Animales: [
    "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯",
    "🦁","🐮","🐷","🐸","🐵","🙈","🙉","🙊","🐒","🐔",
    "🐧","🐦","🐤","🐣","🦆","🦅","🦉","🦇","🐺","🐗",
  ],
  Comida: [
    "🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐",
    "🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑",
    "🌶️","🌽","🥕","🥔","🍠","🥐","🍞","🥖","🥨","🧀",
    "🍔","🍟","🍕","🌭","🥪","🌮","🌯","🥗","🍝","🍜",
    "🍣","🍤","🥟","🍙","🍰","🎂","🍩","🍪","🍫","🍿",
    "🍺","🍻","🥂","🍷","🥃","🍸","🍹","🍶","🥤","🧊",
  ],
  Objetos: [
    "📱","💻","⌨️","🖥","🖨","🖱","💽","💾","💿","📀",
    "📷","📸","📹","🎥","📞","☎️","📟","📠","📺","📻",
    "🔋","🔌","💡","🔦","🕯","💵","💴","💶","💷","💰",
    "💳","💎","⚖️","🧰","🔧","🔨","⛏","🛠","🗡","⚔️",
  ],
  Símbolos: [
    "✅","☑️","✔️","❌","❎","⭕","🚫","⛔","📛","🔞",
    "❗","❓","❕","❔","‼️","⁉️","⚠️","🚸","🔱","⚜️",
    "🔰","♻️","✳️","❇️","✴️","💲","💱","®️","©️","™️",
    "🆗","🆖","🆕","🆒","🆓","🔥","✨","🎉","🎊","💯",
  ],
};

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  onSeleccionar: (emoji: string) => void;
}

export function SelectorEmoji({ abierto, onCerrar, onSeleccionar }: Props) {
  const [categoria, setCategoria] = useState<keyof typeof CATEGORIAS>("Caras");
  const refContainer = useRef<HTMLDivElement>(null);

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!abierto) return;
    function alClick(e: MouseEvent) {
      if (
        refContainer.current &&
        !refContainer.current.contains(e.target as Node)
      ) {
        onCerrar();
      }
    }
    // setTimeout para que el click que abrió el picker no lo cierre inmediato
    const t = setTimeout(() => {
      document.addEventListener("mousedown", alClick);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", alClick);
    };
  }, [abierto, onCerrar]);

  if (!abierto) return null;
  const emojis = CATEGORIAS[categoria]!;

  return (
    <div
      ref={refContainer}
      className="absolute bottom-full left-0 z-20 mb-2 w-[340px] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        {Object.keys(CATEGORIAS).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoria(cat as keyof typeof CATEGORIAS)}
            className={`flex-1 px-2 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
              cat === categoria
                ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
      <div className="grid max-h-[260px] grid-cols-8 gap-1 overflow-y-auto p-2">
        {emojis.map((e, i) => (
          <button
            key={`${categoria}-${i}-${e}`}
            type="button"
            onClick={() => onSeleccionar(e)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-transform hover:scale-125 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title={e}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
