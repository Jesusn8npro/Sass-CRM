"use client";

import { useEffect, useState } from "react";

export type Tema = "claro" | "oscuro";

export function useTema(): {
  tema: Tema;
  alternar: () => void;
  establecer: (t: Tema) => void;
  montado: boolean;
} {
  const [tema, setTema] = useState<Tema>("oscuro");
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    const tieneClase = document.documentElement.classList.contains("dark");
    setTema(tieneClase ? "oscuro" : "claro");
    setMontado(true);
  }, []);

  function aplicar(t: Tema) {
    if (t === "oscuro") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    try {
      localStorage.setItem("tema", t);
    } catch {
      // ignorar
    }
    setTema(t);
  }

  return {
    tema,
    montado,
    alternar: () => aplicar(tema === "oscuro" ? "claro" : "oscuro"),
    establecer: aplicar,
  };
}
