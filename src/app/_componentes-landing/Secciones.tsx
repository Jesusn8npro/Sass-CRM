"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import "./landing.css";

// ── Counter hook (used by StatNum) ─────────────────────────────────────────
function useCounter(target: number, duration = 1800): [number, React.RefObject<HTMLSpanElement>] {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null!);
  const started = useRef(false);

  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const tick = (t: number) => {
            const p = Math.min((t - start) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            setVal(target * eased);
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      });
    }, { threshold: 0.4 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [target, duration]);

  return [val, ref];
}

// ── Reveal hook ────────────────────────────────────────────────────────────
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    if (!els.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("visible");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.1 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

// ── Stats / Metricas ───────────────────────────────────────────────────────
function StatNum({ value, prefix = "", suffix = "", decimals = 0 }: { value: number; prefix?: string; suffix?: string; decimals?: number }) {
  const [v, ref] = useCounter(value, 2000);
  const formatted = decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString("es-ES");
  return <span ref={ref}>{prefix}{formatted}{suffix}</span>;
}

export function Metricas() {
  useReveal();
  return (
    <section className="stats-section">
      <div className="l-container">
        <div className="stats-grid reveal">
          <div className="stat-cell">
            <div className="stat-num"><StatNum prefix="+" value={342} suffix="%" /></div>
            <div className="stat-label">ROI medio en 90 días</div>
          </div>
          <div className="stat-cell">
            <div className="stat-num">24/7</div>
            <div className="stat-label">Operación sin descanso</div>
          </div>
          <div className="stat-cell">
            <div className="stat-num"><StatNum value={8} suffix=" seg" /></div>
            <div className="stat-label">Tiempo medio de respuesta</div>
          </div>
          <div className="stat-cell">
            <div className="stat-num"><StatNum value={1.2} decimals={1} suffix="M+" /></div>
            <div className="stat-label">Conversaciones automatizadas</div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Services / Funciones ───────────────────────────────────────────────────
function IconSvc({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    chat: <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"/>,
    phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92Z"/>,
    target: <><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>,
    zap: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z"/>,
    chart: <><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></>,
    cube: <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.27 6.96 8.73 5.05 8.73-5.05"/><path d="M12 22.08V12"/></>,
  };
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export function Funciones() {
  useReveal();
  const services = [
    { icon: "chat", tag: "", title: "Agentes WhatsApp con IA", desc: "Conversaciones que responden, califican y agendan reuniones 24/7 en tu número de WhatsApp Business.", features: ["Respuesta en menos de 8 segundos", "Aprende de tus mejores closers", "Conectado con tu CRM en directo"] },
    { icon: "phone", tag: "violet", title: "Llamadas automatizadas IA", desc: "Voces neuronales hiperrealistas que llaman, califican prospectos y derivan a humano solo los hot leads.", features: ["Voz neuronal multi-idioma", "Detecta intención de compra", "Reportes + grabaciones"] },
    { icon: "target", tag: "magenta", title: "Prospección masiva", desc: "Encuentra y contacta a tu cliente ideal en LinkedIn, email y WhatsApp en piloto automático.", features: ["Listas ICP inteligentes", "Mensajes personalizados con IA", "+500 prospectos/día"] },
    { icon: "zap", tag: "lime", title: "Automatizaciones no-code", desc: "Conecta todo tu stack y elimina tareas repetitivas con flujos visuales. Cero código, cero excusas.", features: ["+200 integraciones nativas", "Builder visual drag & drop", "Triggers en tiempo real"] },
    { icon: "chart", tag: "", title: "Ventas multi-canal", desc: "Pipeline orquestado por IA: secuencias, follow-ups y cierres a gran escala en múltiples canales.", features: ["A/B testing automático", "Predicción de cierre", "Multi-canal sincronizado"] },
    { icon: "cube", tag: "violet", title: "CRM con superpoderes IA", desc: "CRM nativo + IA que enriquece datos, prioriza leads y te dice exactamente qué hacer después.", features: ["Lead scoring automático", "Resumen de conversación", "Coach de ventas integrado"] },
  ];

  const handleMove = (e: React.MouseEvent<HTMLElement>) => {
    const c = e.currentTarget;
    const r = c.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    c.style.setProperty("--mx", x + "%");
    c.style.setProperty("--my", y + "%");
    const dx = (e.clientX - r.left - r.width / 2) / r.width;
    const dy = (e.clientY - r.top - r.height / 2) / r.height;
    c.style.transform = `perspective(800px) rotateY(${dx * 6}deg) rotateX(${-dy * 6}deg) translateY(-4px)`;
  };
  const handleLeave = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.transform = ""; };

  return (
    <section id="servicios" className="l-section">
      <div className="l-container">
        <div className="section-head reveal">
          <span className="eyebrow">Todo lo que vende, en un sitio</span>
          <h2>6 superpoderes que <span className="gradient-text">reemplazan</span> a tu equipo comercial</h2>
          <p>Olvídate de pagar 8 herramientas + 3 SDRs. Una sola plataforma que prospecta, conversa, llama y cierra por ti, 24/7, sin descansos ni excusas.</p>
        </div>
        <div className="services-grid">
          {services.map((s, i) => (
            <article key={i} className={`svc-card ${s.tag} reveal`} onMouseMove={handleMove} onMouseLeave={handleLeave}>
              <div className="svc-card-inner">
                <div className="svc-icon"><IconSvc name={s.icon} /></div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
                <ul className="svc-features">
                  {s.features.map((f, j) => <li key={j}>{f}</li>)}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── How it works ───────────────────────────────────────────────────────────
export function ComoFunciona() {
  useReveal();
  const steps = [
    { n: "01", title: "Conecta tus canales", desc: "WhatsApp, email, LinkedIn, voz y CRM en menos de 10 minutos. Sin tocar una sola línea de código." },
    { n: "02", title: "Entrena tu agente", desc: "Sube tu pitch, FAQs y casos reales. La IA aprende a vender como tu mejor closer en horas, no semanas." },
    { n: "03", title: "Lanza y escala", desc: "La IA prospecta, conversa y cierra 24/7. Tú revisas reportes, firmas contratos y dejas de fichar a las 8." },
  ];
  return (
    <section id="como" className="l-section" style={{ background: "linear-gradient(180deg, transparent, rgba(15,16,30,0.4), transparent)" }}>
      <div className="l-container">
        <div className="section-head reveal" style={{ textAlign: "center", margin: "0 auto 64px" }}>
          <span className="eyebrow">Cómo funciona Inyectaia</span>
          <h2>De cero a IA inyectada en <span className="gradient-text">72 horas</span></h2>
          <p style={{ maxWidth: 580, margin: "0 auto" }}>Implementación guiada por un experto. Sin código, sin migraciones eternas, sin dolores de cabeza. Solo resultados.</p>
        </div>
        <div className="how-grid">
          {steps.map((s, i) => (
            <div className="how-step reveal" key={i}>
              <div className="how-num">{s.n}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Demo ───────────────────────────────────────────────────────────────────
export function Demo() {
  useReveal();
  const [tab, setTab] = useState("whatsapp");
  const tabs = [
    { id: "whatsapp", label: "💬 Agente WhatsApp" },
    { id: "dashboard", label: "📊 Dashboard" },
    { id: "voice", label: "📞 Llamada IA" },
  ];
  return (
    <section id="demo" className="l-section">
      <div className="l-container">
        <div className="section-head reveal">
          <span className="eyebrow">Demo en vivo</span>
          <h2>Mira a tu nuevo <span className="gradient-text">closer virtual</span> en acción</h2>
          <p>Una conversación real entre nuestro agente de IA y un lead frío. Sin ediciones, en tiempo real.</p>
        </div>
        <div className="demo-tabs reveal">
          {tabs.map((t) => (
            <button key={t.id} className={`demo-tab${tab === t.id ? " active" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>
        <div className="demo-grid">
          {tab === "whatsapp" && <WhatsAppDemo />}
          {tab === "voice" && <VoiceDemo />}
          {tab === "dashboard" && <VoiceDemo />}
          <DashboardSide />
        </div>
      </div>
    </section>
  );
}

function WhatsAppDemo() {
  const messages = [
    { from: "them", text: "Hola, vi vuestra web. ¿Cómo funciona exactamente?", time: "10:42" },
    { from: "me", text: "¡Hola Laura! 👋 Te explico en 30 segundos: nuestra IA habla con tus leads por WhatsApp 24/7 y agenda solo los que están listos para comprar.", time: "10:42" },
    { from: "them", text: "¿Y funciona en mi sector? Vendo cursos online.", time: "10:43" },
    { from: "me", text: "Sí, tenemos +120 clientes de infoproductos. Uno cerró 47k€ el mes pasado con nuestro flujo. ¿Te enseño la demo?", time: "10:43" },
    { from: "them", text: "Vale, mándame info.", time: "10:44" },
    { from: "me", text: "¿Te va bien mañana a las 16:00 para una llamada de 15 min? Te enseño tu setup personalizado en directo.", time: "10:44" },
  ];
  return (
    <div className="phone-mock reveal">
      <div className="phone-screen">
        <div className="wa-header">
          <div className="wa-avatar">IA</div>
          <div className="wa-meta">
            <div className="wa-name">Inyectaia · Asistente</div>
            <div className="wa-status">En línea</div>
          </div>
        </div>
        <div className="wa-chat">
          {messages.map((m, i) => (
            <div key={i} className={`wa-bubble ${m.from}`} style={{ animationDelay: `${i * 0.5}s` }}>
              {m.text} <span className="wa-time">{m.time}</span>
            </div>
          ))}
          <div className="wa-typing"><span /><span /><span /></div>
        </div>
        <div className="wa-input">
          <div className="wa-input-bar">Escribe un mensaje...</div>
          <div className="wa-send">→</div>
        </div>
      </div>
    </div>
  );
}

function VoiceDemo() {
  return (
    <div className="phone-mock reveal" style={{ borderRadius: 18 }}>
      <div className="phone-screen" style={{ height: 480, background: "radial-gradient(circle at 50% 30%, rgba(138,92,255,0.3), #0a0e1f)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, gap: 16 }}>
        <div style={{ width: 120, height: 120, borderRadius: "50%", background: "linear-gradient(135deg, #8a5cff, #00e5ff)", display: "grid", placeItems: "center", fontSize: 36, boxShadow: "0 0 60px rgba(138,92,255,0.6)" }}>🎙️</div>
        <div style={{ fontWeight: 600, fontSize: 18 }}>Llamando a Carlos R.</div>
        <div className="mono" style={{ color: "var(--cyan)", fontSize: 14 }}>00:02:14</div>
        <div style={{ textAlign: "center", fontSize: 13, color: "var(--ink-dim)", maxWidth: 240, marginTop: 12 }}>
          &ldquo;Hola Carlos, soy María del equipo Inyectaia, ¿tienes 2 minutos?&rdquo;
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <span className="dash-pill live" style={{ fontSize: 10 }}>EN VIVO</span>
          <span className="dash-pill" style={{ fontSize: 10 }}>SENTIMIENTO: POSITIVO</span>
        </div>
      </div>
    </div>
  );
}

function DashboardSide() {
  return (
    <div className="dash-mock reveal">
      <div className="dash-head">
        <div>
          <div className="dash-title">Panel de operaciones · Hoy</div>
          <div style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 2 }}>Tiempo real · Últimas 24h</div>
        </div>
        <div className="dash-pills">
          <span className="dash-pill live">LIVE</span>
          <span className="dash-pill">24H</span>
        </div>
      </div>
      <div className="dash-kpis">
        <div className="dash-kpi"><div className="lbl">Leads</div><div className="val">+218</div><div className="delta">↑ 32%</div></div>
        <div className="dash-kpi"><div className="lbl">Reuniones</div><div className="val">47</div><div className="delta">↑ 18%</div></div>
        <div className="dash-kpi"><div className="lbl">Cierres</div><div className="val">€12.4k</div><div className="delta">↑ 41%</div></div>
      </div>
      <div className="dash-chart">
        <div style={{ fontSize: 12, color: "var(--ink-faint)", marginBottom: 8 }}>Conversaciones por hora</div>
        <div className="chart-bars">
          {[40, 65, 80, 55, 90, 75, 95, 70, 88, 60, 78, 92].map((h, i) => (
            <div key={i} className={`chart-bar${i % 3 === 0 ? " alt" : ""}`} style={{ height: h + "%", animationDelay: `${i * 0.05}s` }} />
          ))}
        </div>
        <div className="chart-legend"><span>WhatsApp</span><span>Llamadas IA</span></div>
      </div>
      <div className="dash-list">
        <div className="dash-row">
          <div className="av" style={{ background: "linear-gradient(135deg,#00e5ff,#8a5cff)" }}>LM</div>
          <div><div className="nm">Laura Martín</div><span className="meta">Pidió demo · Hace 4 min</span></div>
          <span className="badge">HOT 92</span>
        </div>
        <div className="dash-row">
          <div className="av" style={{ background: "linear-gradient(135deg,#ff3ec9,#8a5cff)" }}>CR</div>
          <div><div className="nm">Carlos Ramírez</div><span className="meta">Llamada agendada</span></div>
          <span className="badge warn">WARM 71</span>
        </div>
      </div>
    </div>
  );
}

// ── Casos de uso ───────────────────────────────────────────────────────────
export function CasosDeUso() {
  useReveal();
  const cases = [
    { tags: ["SaaS B2B", "Outbound"], title: "De 12 a 184 demos al mes", meta: "Crecimiento · 4 meses", cls: "x6", c1: "#1a0f3a", c2: "#00e5ff" },
    { tags: ["E-commerce"], title: "Carritos recuperados +212%", meta: "Shopify · Moda", cls: "x3", c1: "#2d0b3a", c2: "#ff3ec9" },
    { tags: ["Infoproducto"], title: "€47k en una semana", meta: "Lanzamiento curso", cls: "x3", c1: "#051422", c2: "#00e5ff" },
    { tags: ["Real Estate"], title: "500 leads cualificados/mes", meta: "Inmobiliaria Madrid", cls: "x4", c1: "#1a0a2e", c2: "#b6ff3c" },
    { tags: ["Servicios", "B2B"], title: "SDR sustituido por agente IA", meta: "Agencia de marketing", cls: "x8", c1: "#0a0e1f", c2: "#8a5cff" },
  ];
  return (
    <section id="trabajos" className="l-section">
      <div className="l-container">
        <div className="section-head reveal">
          <span className="eyebrow">Casos de éxito</span>
          <h2>Trabajos reales con <span className="gradient-text">resultados reales</span></h2>
          <p>Clientes que confiaron en Inyectaia y multiplicaron su pipeline en menos de 6 meses.</p>
        </div>
        <div className="work-grid">
          {cases.map((c, i) => (
            <article className={`work-card reveal ${c.cls}`} key={i}>
              <div className="image-slot">
                <div className="placeholder" style={{ "--c1": c.c1, "--c2": c.c2 } as React.CSSProperties}>
                  <span className="placeholder-text">case study · imagen</span>
                </div>
              </div>
              <div className="work-tags">{c.tags.map((t, j) => <span className="work-tag" key={j}>{t}</span>)}</div>
              <div className="work-title">{c.title}</div>
              <div className="work-meta">{c.meta}</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Video ──────────────────────────────────────────────────────────────────
export function VideoSection() {
  useReveal();
  const thumbs = [
    { title: "Cómo construir tu primer agente", dur: "03:24", c1: "#2d0b3a", c2: "#ff3ec9" },
    { title: "Setup de WhatsApp Business API", dur: "05:12", c1: "#0a0e1f", c2: "#00e5ff" },
    { title: "Caso real: agencia 10x pipeline", dur: "08:47", c1: "#1a0f3a", c2: "#8a5cff" },
  ];
  return (
    <section id="video" className="l-section" style={{ background: "linear-gradient(180deg, transparent, rgba(15,16,30,0.5), transparent)" }}>
      <div className="l-container">
        <div className="section-head reveal">
          <span className="eyebrow">Videos y demos</span>
          <h2>Ve la plataforma en <span className="gradient-text">acción</span></h2>
          <p>Demos en vídeo, tutoriales y casos reales explicados por nuestro equipo.</p>
        </div>
        <div className="video-wrap reveal">
          <div className="placeholder" style={{ "--c1": "#1a0f3a", "--c2": "#051422" } as React.CSSProperties}>
            <span className="placeholder-text">video hero · demo producto</span>
          </div>
          <button className="video-play" aria-label="Reproducir video" />
        </div>
        <div className="video-grid">
          {thumbs.map((v, i) => (
            <div className="video-thumb reveal" key={i}>
              <div className="placeholder" style={{ "--c1": v.c1, "--c2": v.c2 } as React.CSSProperties}>
                <span className="placeholder-text">{v.title}</span>
              </div>
              <div className="mini-play" />
              <div className="duration">{v.dur}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Blog ───────────────────────────────────────────────────────────────────
type BlogPost = {
  slug: string;
  titulo: string;
  resumen: string;
  categoria_nombre?: string | null;
  tiempo_lectura_min: number;
  publicado_en?: string | null;
  imagen_portada_url?: string | null;
  imagen_portada_alt?: string | null;
};

const MOCK_POSTS: BlogPost[] = [
  { slug: "#", titulo: "7 plantillas de WhatsApp que convierten leads fríos", resumen: "Las plantillas exactas que usan nuestros clientes para abrir conversaciones que sí responden.", categoria_nombre: "PROSPECCIÓN", tiempo_lectura_min: 6, publicado_en: "2026-05-12" },
  { slug: "#", titulo: "Por qué tu próximo SDR no será humano (y está bien)", resumen: "El futuro del outbound ya no es 'humano vs IA'. Es híbrido. Te explicamos por qué.", categoria_nombre: "IA · VENTAS", tiempo_lectura_min: 8, publicado_en: "2026-05-08" },
  { slug: "#", titulo: "Cómo una agencia pasó de 30 a 280 reuniones/mes", resumen: "El stack exacto que usaron, las decisiones, los errores y los números que validan el modelo.", categoria_nombre: "CASO REAL", tiempo_lectura_min: 11, publicado_en: "2026-05-02" },
];

const CARD_COLORS = [
  { c1: "#1a0f3a", c2: "#8a5cff" },
  { c1: "#051422", c2: "#00e5ff" },
  { c1: "#2d0b3a", c2: "#ff3ec9" },
];

export function BlogSection({ posts }: { posts?: BlogPost[] }) {
  useReveal();
  const items = posts && posts.length > 0 ? posts.slice(0, 3) : MOCK_POSTS;

  return (
    <section id="blog-preview" className="l-section">
      <div className="l-container">
        <div className="section-head reveal">
          <span className="eyebrow">Blog</span>
          <h2>Aprende a vender con <span className="gradient-text">IA de verdad</span></h2>
          <p>Guías, casos y plantillas listas para copiar. Cero teoría, todo aplicable.</p>
        </div>
        <div className="blog-grid">
          {items.map((p, i) => {
            const colors = CARD_COLORS[i % CARD_COLORS.length];
            const fecha = p.publicado_en ? new Date(p.publicado_en).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" }) : "";
            return (
              <Link href={p.slug !== "#" ? `/blog/${p.slug}` : "/blog"} key={p.slug + i} className="blog-card reveal" style={{ textDecoration: "none" }}>
                <div className="blog-cover">
                  {p.imagen_portada_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imagen_portada_url} alt={p.imagen_portada_alt ?? p.titulo} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div className="placeholder" style={{ "--c1": colors.c1, "--c2": colors.c2 } as React.CSSProperties}>
                      <span className="placeholder-text">portada · artículo</span>
                    </div>
                  )}
                </div>
                <div className="blog-body">
                  <div className="blog-meta">{p.categoria_nombre ?? "BLOG"} · {p.tiempo_lectura_min} min lectura</div>
                  <div className="blog-title">{p.titulo}</div>
                  <p className="blog-excerpt">{p.resumen}</p>
                  <div className="blog-foot">
                    <span>{fecha}</span>
                    <span style={{ color: "var(--cyan)" }}>Leer →</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
