"use client";

import { useState, useEffect, useRef } from "react";

// ── Counter hook ───────────────────────────────────────────────────────────
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

function CountUp({ end, duration = 1400 }: { end: number; duration?: number }) {
  const [v, ref] = useCounter(end, duration);
  return <span ref={ref}>{Math.round(v)}</span>;
}

const ROTATING_WORDS = ["llama", "conversa", "califica", "cierra", "cobra"];

// ── Hero ───────────────────────────────────────────────────────────────────
export function Hero() {
  const stageRef = useRef<HTMLDivElement>(null);
  const visualRef = useRef<HTMLDivElement>(null);
  const [wordIdx, setWordIdx] = useState(0);
  const [tickerIdx, setTickerIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setWordIdx((i) => (i + 1) % ROTATING_WORDS.length), 2200);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTickerIdx((i) => i + 1), 3500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (!visualRef.current || !stageRef.current) return;
      const r = visualRef.current.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = (e.clientX - cx) / r.width;
      const dy = (e.clientY - cy) / r.height;
      stageRef.current.style.transform = `rotateY(${dx * 14}deg) rotateX(${-dy * 14}deg)`;
    };
    window.addEventListener("mousemove", handle);
    return () => window.removeEventListener("mousemove", handle);
  }, []);

  const tickerItems = [
    { icon: "💬", text: "Laura M. acaba de pedir una demo", time: "ahora" },
    { icon: "🔥", text: "+12 conversaciones cerradas en la última hora", time: "1m" },
    { icon: "💰", text: "Stackform cerró €4.200 con un agente IA", time: "3m" },
    { icon: "📞", text: "Llamada IA en curso · sentimiento positivo", time: "5m" },
    { icon: "✨", text: "Nuevo cliente onboarded · Madrid", time: "8m" },
  ];
  const ticker = tickerItems[tickerIdx % tickerItems.length];

  return (
    <section className="hero-section" id="hero">
      <div className="l-container">
        <div className="hero-grid">
          <div className="hero-left">
            <div className="hero-eyebrow-row">
              <span className="eyebrow">
                <span className="pulse-dot" /> EN VIVO · 47 demos agendadas hoy
              </span>
              <span className="eyebrow eyebrow-soft">v3.0 · Lanzado esta semana</span>
            </div>

            <h1 className="hero-title">
              <span className="gradient-text">Inyecta IA</span>.<br />
              <span className="word-rotator">
                <span key={wordIdx} className="rotating-word">{ROTATING_WORDS[wordIdx]}</span>
              </span>{" "}
              <span className="stroke-word">por ti.</span>
            </h1>

            <p className="hero-sub">
              <strong>Inyectaia.com</strong> instala IA en las arterias comerciales de tu negocio: prospecta, llama y cierra en WhatsApp <strong>24/7</strong>. Multiplica tus ventas <strong>x3 en 90 días</strong> sin contratar un solo SDR más.
            </p>

            <div className="hero-ctas">
              <a href="#demo" className="l-btn l-btn-primary l-btn-lg">
                <span>Inyectar IA en mi negocio →</span>
                <span className="btn-sub">Setup gratis · 14 días</span>
              </a>
              <a href="#video" className="l-btn l-btn-ghost l-btn-lg">
                <span className="play-icon">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                </span>
                <span>Ver demo · 2 min</span>
              </a>
            </div>

            <div className="hero-trust">
              <div className="trust-avatars">
                <span style={{ background: "linear-gradient(135deg,#00e5ff,#8a5cff)" }}>AV</span>
                <span style={{ background: "linear-gradient(135deg,#ff3ec9,#8a5cff)" }}>DF</span>
                <span style={{ background: "linear-gradient(135deg,#b6ff3c,#00e5ff)" }}>MS</span>
                <span style={{ background: "linear-gradient(135deg,#8a5cff,#ff3ec9)" }}>JR</span>
                <span className="trust-more">+1.2k</span>
              </div>
              <div className="trust-text">
                <div className="trust-stars">★★★★★ <strong>4.9</strong> <span style={{ color: "var(--ink-faint)" }}>(184 reseñas verificadas)</span></div>
                <div className="trust-sub">+1.247 empresas activas · ROI medio +342% en 90 días</div>
              </div>
            </div>

            <div className="hero-ticker" aria-live="polite">
              <span className="ticker-live">● LIVE</span>
              <span className="ticker-icon">{ticker.icon}</span>
              <span className="ticker-text" key={tickerIdx}>{ticker.text}</span>
              <span className="ticker-time">{ticker.time}</span>
            </div>
          </div>

          <div className="hero-visual" ref={visualRef}>
            <div className="sphere-stage" ref={stageRef}>
              <div className="hero-grid-bg" />
              <div className="sphere-ring r3" />
              <div className="sphere-ring r1" />
              <div className="sphere-ring r2" />
              <div className="sphere-core" />
              <div className="sphere-node n1" />
              <div className="sphere-node n2" />
              <div className="sphere-node n3" />
              <div className="sphere-node n4" />

              <div className="hero-card hero-card-chat" style={{ "--d": 0 } as React.CSSProperties}>
                <div className="hc-head">
                  <div className="hc-dot" style={{ background: "#25d366" }} />
                  <span>WhatsApp Agente</span>
                  <span className="hc-time">en vivo</span>
                </div>
                <div className="hc-bubble them">Hola, ¿cuánto cuesta?</div>
                <div className="hc-bubble me">Te lo explico en 30s 👋</div>
                <div className="hc-typing"><span /><span /><span /></div>
              </div>

              <div className="hero-card hero-card-kpi" style={{ "--d": 0.4 } as React.CSSProperties}>
                <div className="hc-kpi-label">Reuniones hoy</div>
                <div className="hc-kpi-val">+<CountUp end={47} /></div>
                <div className="hc-kpi-delta">↑ 32% vs ayer</div>
                <svg className="hc-spark" viewBox="0 0 100 30" preserveAspectRatio="none">
                  <path d="M0,22 L15,18 L25,20 L40,12 L55,15 L70,8 L85,10 L100,4" stroke="url(#sparkG)" strokeWidth="2" fill="none" strokeLinecap="round" />
                  <defs><linearGradient id="sparkG"><stop offset="0" stopColor="#00e5ff" /><stop offset="1" stopColor="#ff3ec9" /></linearGradient></defs>
                </svg>
              </div>

              <div className="hero-card hero-card-voice" style={{ "--d": 0.8 } as React.CSSProperties}>
                <div className="hc-voice-icon">🎙️</div>
                <div>
                  <div className="hc-voice-title">Llamada IA</div>
                  <div className="hc-voice-time mono">00:02:14</div>
                </div>
                <div className="hc-wave">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <span key={i} style={{ animationDelay: `${i * 0.08}s` }} />
                  ))}
                </div>
              </div>

              <div className="hero-card hero-card-deal" style={{ "--d": 1.2 } as React.CSSProperties}>
                <div className="hc-deal-badge">DEAL CERRADO</div>
                <div className="hc-deal-amount">€12.480</div>
                <div className="hc-deal-meta">Cliente: Stackform · Hace 4 min</div>
              </div>
            </div>
            <div className="hero-halo" />
          </div>
        </div>

        <div className="scroll-hint" aria-hidden="true">
          <span>SCROLL</span>
          <div className="scroll-bar"><div className="scroll-bar-inner" /></div>
        </div>
      </div>
    </section>
  );
}
