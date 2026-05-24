"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import "./landing.css";

// ============ LOGO SVG ============
// Each instance needs unique gradient IDs to avoid duplicate-ID reconciliation errors
export function LogoSVG({ size = 36, uid = "a" }: { size?: number; uid?: string }) {
  const g1 = `lg1-${uid}`;
  const g2 = `lg2-${uid}`;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={g1} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#00e5ff"/>
          <stop offset="0.6" stopColor="#8a5cff"/>
          <stop offset="1" stopColor="#ff3ec9"/>
        </linearGradient>
        <linearGradient id={g2} x1="0" y1="0" x2="40" y2="40">
          <stop offset="0" stopColor="#00e5ff" stopOpacity="0.6"/>
          <stop offset="1" stopColor="#ff3ec9" stopOpacity="0.6"/>
        </linearGradient>
      </defs>
      <path d="M20 2 L36 11 L36 29 L20 38 L4 29 L4 11 Z" stroke={`url(#${g1})`} strokeWidth="1.5" fill="rgba(138, 92, 255, 0.08)"/>
      <path d="M14 13 L26 13 L26 18 L21.5 18 L21.5 27 L18.5 27 L18.5 18 L14 18 Z" fill={`url(#${g1})`}/>
      <circle cx="20" cy="20" r="14" stroke={`url(#${g2})`} strokeWidth="0.8" strokeDasharray="2 3" opacity="0.5"/>
    </svg>
  );
}

export const Logo = LogoSVG;

// ============ ICON ============
function Icon({ name, size = 24 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    chat: <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"/>,
    phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92Z"/>,
    target: <><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>,
    zap: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z"/>,
    chart: <><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></>,
    cube: <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.27 6.96 8.73 5.05 8.73-5.05"/><path d="M12 22.08V12"/></>,
    twitter: <path d="M22 4.01c-1 .49-1.98.689-3 .99-1.121-1.265-2.783-1.335-4.38-.737S11.977 6.323 12 8v1c-3.245.083-6.135-1.395-8-4 0 0-4.182 7.433 4 11-1.872 1.247-3.739 2.088-6 2 3.308 1.803 6.913 2.423 10.034 1.517 3.58-1.04 6.522-3.723 7.651-7.742a13.84 13.84 0 0 0 .497-3.753C20.18 7.773 21.692 5.25 22 4.009Z"/>,
    linkedin: <><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6Z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2" fill="currentColor"/></>,
    instagram: <><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37Z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></>,
    youtube: <><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33Z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="currentColor"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

const MEGA_SERVICES = [
  { icon: "chat", href: "/servicios/agentes-ia",    title: "Agentes WhatsApp IA",  desc: "Responden y agendan 24/7" },
  { icon: "phone", href: "/servicios/llamadas-ia",  title: "Llamadas IA",           desc: "Voz neuronal multi-idioma" },
  { icon: "target", href: "/servicios/prospeccion", title: "Prospección masiva",    desc: "+500 leads/día en piloto auto" },
  { icon: "zap", href: "/servicios/automatizacion", title: "Automatizaciones",      desc: "Flujos no-code con +200 apps" },
  { icon: "chart", href: "/servicios",              title: "Ventas multi-canal",    desc: "Pipeline orquestado por IA" },
  { icon: "cube", href: "/servicios/analisis",      title: "CRM con IA",            desc: "CRM nativo + scoring automático" },
];

const NAV_LINKS = [
  { href: "/servicios", label: "Servicios", mega: true },
  { href: "#como", label: "Cómo funciona" },
  { href: "/demo", label: "Demo" },
  { href: "/nosotros", label: "Sobre nosotros" },
  { href: "/trabajos", label: "Trabajos" },
  { href: "#precios", label: "Precios" },
  { href: "/blog", label: "Blog" },
];

const DRAWER_LINKS = [
  { href: "/servicios", label: "Servicios" },
  { href: "#como", label: "Cómo funciona" },
  { href: "/demo", label: "Demo" },
  { href: "/nosotros", label: "Sobre nosotros" },
  { href: "/trabajos", label: "Trabajos" },
  { href: "#precios", label: "Precios" },
  { href: "/blog", label: "Blog" },
];

export function Navegacion() {
  const [scrolled, setScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [active, setActive] = useState("hero");
  const [megaOpen, setMegaOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const ids = ["hero", "servicios", "como", "demo", "precios", "blog"];
    const handle = () => {
      const y = window.scrollY + 140;
      let current = "hero";
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.offsetTop <= y) current = id;
      }
      setActive(current);
    };
    handle();
    window.addEventListener("scroll", handle, { passive: true });
    return () => window.removeEventListener("scroll", handle);
  }, []);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  return (
    <>
      {/* Top banner */}
      <div className="top-banner">
        <div className="l-container top-banner-inner">
          <span>🔥 <strong>Inyectaia v3.0</strong> está aquí · <strong>−40% los 3 primeros meses</strong> hasta el 30 de junio</span>
          <a href="#precios">Reclamar oferta →</a>
        </div>
      </div>

      {/* Main nav */}
      <header className={`l-nav${scrolled ? " scrolled" : ""}`}>
        <div className="l-container nav-inner">
          <Link href="/" className="brand" aria-label="Inyectaia — Inicio">
            <span className="brand-mark"><LogoSVG size={36} uid="nav" /></span>
            <span className="brand-name">inyect<span>ai</span>a<span className="brand-tld">.com</span></span>
          </Link>

          <nav className="nav-links" aria-label="Principal">
            {NAV_LINKS.map((l) => {
              const isActive = active === l.href.replace("#", "");
              if (l.mega) {
                return (
                  <div
                    key={l.href}
                    className="nav-link-wrap has-mega"
                    onMouseEnter={() => setMegaOpen(true)}
                    onMouseLeave={() => setMegaOpen(false)}
                  >
                    <Link href={l.href} className={isActive ? "active" : ""}>
                      {l.label}
                      <span className="nav-caret">▾</span>
                    </Link>
                    {megaOpen && (
                      <div className="mega-menu">
                        <div className="mega-grid">
                          {MEGA_SERVICES.map((s, i) => (
                            <Link key={i} href={s.href} className="mega-item" onClick={() => setMegaOpen(false)}>
                              <span className="mega-icon"><Icon name={s.icon} size={18} /></span>
                              <div>
                                <div className="mega-title">{s.title}</div>
                                <div className="mega-desc">{s.desc}</div>
                              </div>
                            </Link>
                          ))}
                        </div>
                        <div className="mega-promo">
                          <div className="mega-promo-tag">DESTACADO</div>
                          <div className="mega-promo-title">Inyectaia para Agencias</div>
                          <div className="mega-promo-desc">Revende nuestra IA a tus clientes. White-label completo y comisión recurrente del 30%.</div>
                          <a href="/demo" className="mega-promo-link" onClick={() => setMegaOpen(false)}>Saber más →</a>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <div key={l.href} className="nav-link-wrap">
                  <Link href={l.href} className={isActive ? "active" : ""}>{l.label}</Link>
                </div>
              );
            })}
          </nav>

          <div className="nav-cta">
            <Link href="/login" className="l-btn l-btn-ghost l-btn-sm desktop-only">Iniciar sesión</Link>
            <Link href="/signup" className="l-btn l-btn-primary l-btn-sm">
              <span>Inyectar IA →</span>
            </Link>
            <button
              className="hamburger"
              onClick={() => setDrawerOpen(true)}
              aria-label="Abrir menú"
            >
              <span /><span /><span />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer backdrop */}
      <div
        className={`drawer-backdrop${drawerOpen ? " open" : ""}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />

      {/* Mobile drawer */}
      <aside className={`drawer${drawerOpen ? " open" : ""}`} aria-modal="true" role="dialog">
        <div className="drawer-head">
          <div className="brand">
            <span className="brand-mark"><LogoSVG size={32} uid="drawer" /></span>
            <span className="brand-name">inyect<span>ai</span>a<span className="brand-tld">.com</span></span>
          </div>
          <button className="drawer-close" onClick={() => setDrawerOpen(false)} aria-label="Cerrar menú">×</button>
        </div>
        <nav className="drawer-links">
          {DRAWER_LINKS.map((l, i) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setDrawerOpen(false)}
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              <span className="drawer-link-num">0{i + 1}</span>
              <span>{l.label}</span>
              <span className="drawer-link-arrow">→</span>
            </a>
          ))}
        </nav>
        <div className="drawer-foot">
          <a href="/demo" className="l-btn l-btn-primary" onClick={() => setDrawerOpen(false)}>
            <span>Empezar gratis →</span>
          </a>
          <a href="https://wa.me/34600000000" className="l-btn l-btn-ghost">💬 Hablar por WhatsApp</a>
          <div className="drawer-meta">
            <span>⭐ 4.9/5</span>
            <span>+1.247 clientes</span>
            <span>● Online</span>
          </div>
        </div>
      </aside>
    </>
  );
}

export function PieDePagina() {
  return (
    <footer className="l-footer">
      <div className="l-container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link href="/" className="brand">
              <span className="brand-mark"><LogoSVG size={32} uid="footer" /></span>
              <span className="brand-name">inyect<span>ai</span>a<span className="brand-tld">.com</span></span>
            </Link>
            <p>Inyectamos IA en las arterias comerciales de tu negocio. Vendes más, contratas menos, duermes mejor.</p>
            <div className="footer-social">
              <a href="#" aria-label="Twitter"><Icon name="twitter" size={16} /></a>
              <a href="#" aria-label="LinkedIn"><Icon name="linkedin" size={16} /></a>
              <a href="#" aria-label="Instagram"><Icon name="instagram" size={16} /></a>
              <a href="#" aria-label="YouTube"><Icon name="youtube" size={16} /></a>
            </div>
          </div>

          <div className="footer-col">
            <h4>Producto</h4>
            <ul>
              <li><Link href="/servicios">Servicios</Link></li>
              <li><Link href="/servicios/agentes-ia">Agentes WhatsApp</Link></li>
              <li><Link href="/servicios/llamadas-ia">Llamadas IA</Link></li>
              <li><Link href="/servicios/analisis">CRM con IA</Link></li>
              <li><a href="#precios">Precios</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Recursos</h4>
            <ul>
              <li><Link href="/blog">Blog</Link></li>
              <li><a href="#video">Videos</a></li>
              <li><Link href="/trabajos">Casos de éxito</Link></li>
              <li><a href="#">Plantillas</a></li>
              <li><a href="#">Academia</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Empresa</h4>
            <ul>
              <li><Link href="/nosotros">Sobre Inyectaia</Link></li>
              <li><Link href="/nosotros">Nuestra historia</Link></li>
              <li><a href="#">Partners · White-label</a></li>
              <li><a href="#">Carreras</a></li>
              <li><Link href="/contacto">Contacto</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Legal</h4>
            <ul>
              <li><Link href="/privacidad">Privacidad</Link></li>
              <li><Link href="/terminos">Términos</Link></li>
              <li><a href="#">Cookies</a></li>
              <li><a href="#">RGPD</a></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <div>© {new Date().getFullYear()} Inyectaia.com · Inyectando IA desde Madrid ☕</div>
          <div>Estado: <span style={{ color: "var(--lime)" }}>● Todos los sistemas operativos</span></div>
        </div>
      </div>
    </footer>
  );
}

export function BotoneFlotanteWhatsApp() {
  return (
    <a
      className="wa-float"
      href="https://wa.me/34600000000?text=Hola%20quiero%20probar%20Inyectaia"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chatea por WhatsApp"
    >
      <span className="wa-float-label">¿Hablamos? Te respondo al instante</span>
      <span className="wa-float-btn" aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.498 14.382c-.301-.15-1.767-.867-2.04-.966-.273-.101-.473-.15-.673.15-.197.295-.771.964-.944 1.162-.175.195-.349.21-.646.075-.3-.15-1.263-.465-2.403-1.485-.888-.795-1.484-1.77-1.66-2.07-.174-.3-.019-.465.13-.615.136-.135.301-.345.451-.523.146-.181.194-.301.297-.496.1-.21.049-.375-.025-.524-.075-.15-.672-1.62-.922-2.206-.24-.584-.487-.51-.672-.51-.172-.015-.371-.015-.571-.015-.2 0-.523.074-.797.359-.273.3-1.045 1.02-1.045 2.475s1.07 2.865 1.219 3.075c.149.195 2.105 3.195 5.1 4.485.714.3 1.27.48 1.704.629.714.227 1.365.195 1.88.121.574-.091 1.767-.721 2.016-1.426.255-.705.255-1.29.18-1.425-.074-.135-.27-.21-.57-.345m-5.446 7.443h-.016c-1.77 0-3.524-.48-5.055-1.38l-.36-.214-3.75.975 1.005-3.645-.239-.375a9.869 9.869 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884" />
        </svg>
      </span>
    </a>
  );
}

export function StickyCTAMovil() {
  return (
    <div className="sticky-cta">
      <a href="https://wa.me/34600000000" className="l-btn l-btn-ghost">💬 WhatsApp</a>
      <a href="#demo" className="l-btn l-btn-primary"><span>Probar gratis →</span></a>
    </div>
  );
}

// Keep old export names for backward compatibility with other pages that import them
export { Navegacion as default };
