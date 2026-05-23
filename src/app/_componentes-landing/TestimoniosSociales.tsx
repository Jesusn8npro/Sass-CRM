"use client";

import { useEffect } from "react";
import "./landing.css";

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    if (!els.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("visible"); io.unobserve(e.target); }
      });
    }, { threshold: 0.1 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

export function TestimoniosSociales() {
  useReveal();
  const items = [
    { quote: '"Pasamos de 12 demos al mes a 184. El agente de WhatsApp factura más que mi mejor SDR humano."', name: "Andrea Vega", role: "CMO · Stackform", av: "AV", g: "linear-gradient(135deg,#00e5ff,#8a5cff)" },
    { quote: '"Implementamos un viernes, el lunes ya teníamos €4.200 cerrados. Magia, pero con métricas."', name: "Diego Ferrer", role: "Founder · CursosPro", av: "DF", g: "linear-gradient(135deg,#ff3ec9,#8a5cff)" },
    { quote: '"La IA llama, califica y nos pasa solo los hot leads. Hemos quitado un puesto de prospección entero."', name: "María Sánchez", role: "Head of Sales · Proptech", av: "MS", g: "linear-gradient(135deg,#b6ff3c,#00e5ff)" },
  ];
  return (
    <section id="testimonios" className="l-section">
      <div className="l-container">
        <div className="section-head reveal" style={{ textAlign: "center", margin: "0 auto 64px" }}>
          <span className="eyebrow">Lo que dicen</span>
          <h2>Equipos que ya <span className="gradient-text">duermen mejor</span></h2>
        </div>
        <div className="testi-grid">
          {items.map((t, i) => (
            <article className="testi-card reveal" key={i}>
              <div className="testi-stars">★★★★★</div>
              <p className="testi-quote">{t.quote}</p>
              <div className="testi-author">
                <div className="testi-avatar" style={{ background: t.g }}>{t.av}</div>
                <div>
                  <div className="testi-name">{t.name}</div>
                  <div className="testi-role">{t.role}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
