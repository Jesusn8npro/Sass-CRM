"use client";

import { useState, useEffect } from "react";
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

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5"/>
    </svg>
  );
}

// ============ PRICING ============
export function Precios() {
  useReveal();
  const plans = [
    { name: "Starter", price: 97, desc: "Ideal para freelance y emprendedores en solitario.", features: ["1 agente WhatsApp IA", "Hasta 2.000 mensajes/mes", "500 prospectos/mes", "CRM básico", "Soporte por email"] },
    { name: "Growth", price: 297, featured: true, desc: "Para equipos comerciales que quieren escalar.", features: ["5 agentes WhatsApp + voz", "Mensajes ilimitados", "5.000 prospectos/mes", "Llamadas IA · 500 min", "CRM + analítica avanzada", "Onboarding 1-a-1"] },
    { name: "Enterprise", price: "Custom" as const, desc: "Para equipos grandes con necesidades a medida.", features: ["Agentes ilimitados", "Mensajes y voz ilimitados", "Prospección sin tope", "Integraciones a medida", "CSM dedicado", "SLA 99.9% · SSO"] },
  ];
  return (
    <section id="precios" className="l-section">
      <div className="l-container">
        <div className="section-head reveal" style={{ textAlign: "center", margin: "0 auto 64px" }}>
          <span className="eyebrow">Precios</span>
          <h2>Invierte poco. <span className="gradient-text">Recupera mucho.</span></h2>
          <p style={{ maxWidth: 540, margin: "0 auto" }}>El ROI medio en 90 días es de +342%. Garantizado o te devolvemos el dinero.</p>
        </div>
        <div className="pricing-grid">
          {plans.map((p, i) => (
            <div key={i} className={`price-card reveal${p.featured ? " featured" : ""}`}>
              <div className="price-plan">{p.name}</div>
              <div className="price-amount">
                {typeof p.price === "number"
                  ? <><span className="cur">€</span>{p.price}<span className="per">/mes</span></>
                  : p.price
                }
              </div>
              <p className="price-desc">{p.desc}</p>
              <ul className="price-features">
                {p.features.map((f, j) => <li key={j}><CheckIcon /> {f}</li>)}
              </ul>
              <a href="#demo" className={`l-btn${p.featured ? " l-btn-primary" : " l-btn-ghost"}`}>
                <span>{p.name === "Enterprise" ? "Hablar con ventas" : "Empezar ahora"}</span>
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============ FAQ ============
export function PreguntasFrecuentes() {
  useReveal();
  const [open, setOpen] = useState(0);
  const items = [
    { q: "¿Necesito conocimientos técnicos para usar Inyectaia?", a: "Cero. Nuestro equipo te onboardea en una llamada de 30 minutos y dejamos tu primer agente operativo. Después puedes editar todo desde un builder visual." },
    { q: "¿Es compatible con WhatsApp Business API oficial?", a: "Sí. Usamos la API oficial de Meta. Cumplimos todas las políticas de WhatsApp y tu número queda 100% protegido." },
    { q: "¿La IA suena humana o suena a robot?", a: "Suena humana. Entrenamos cada agente con tu tono, tu pitch y ejemplos reales. Pasa el test de Turing comercial el 92% de las veces." },
    { q: "¿Puedo conectarlo con mi CRM actual?", a: "Sí. Integraciones nativas con HubSpot, Pipedrive, Salesforce, Notion y +200 herramientas. Si tu stack es exótico, lo conectamos via API o Make/Zapier." },
    { q: "¿Qué pasa si no funciona en mi negocio?", a: "Garantía de 30 días. Si en el primer mes no ves crecimiento medible en tu pipeline, te devolvemos el 100% sin preguntas." },
    { q: "¿Cómo funciona la facturación?", a: "Mensual o anual (con 2 meses gratis). Cancelas cuando quieras desde el dashboard. Sin permanencias, sin letra pequeña." },
  ];
  return (
    <section id="faq" className="l-section">
      <div className="l-container">
        <div className="section-head reveal" style={{ textAlign: "center", margin: "0 auto 56px" }}>
          <span className="eyebrow">Preguntas frecuentes</span>
          <h2>Lo que <span className="gradient-text">probablemente</span> te estés preguntando</h2>
        </div>
        <div className="l-faq reveal">
          {items.map((it, i) => (
            <div className={`faq-item${open === i ? " open" : ""}`} key={i}>
              <button className="faq-q" onClick={() => setOpen(open === i ? -1 : i)}>
                <span>{it.q}</span>
                <span className="faq-toggle">+</span>
              </button>
              <div className="faq-a">{it.a}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============ CTA FINAL ============
export function CtaFinal() {
  useReveal();
  return (
    <section className="cta-section">
      <div className="l-container">
        <div className="cta-box reveal">
          <span className="eyebrow">Tu turno</span>
          <h2 style={{ marginTop: 16 }}>
            Mientras lees esto,<br />tu competencia ya está<br />
            <span className="gradient-text">inyectando IA en sus ventas.</span>
          </h2>
          <p>Reserva una demo de 15 minutos con un especialista de Inyectaia.com. Sin tarjeta, sin compromiso. Sales con tu primer agente IA configurado y un plan de crecimiento a 90 días.</p>
          <div className="hero-ctas">
            <a href="#demo" className="l-btn l-btn-primary"><span>Inyectar IA en mi negocio →</span></a>
            <a href="https://wa.me/34600000000" className="l-btn l-btn-ghost">💬 Hablar por WhatsApp</a>
          </div>
        </div>
      </div>
    </section>
  );
}
