"use client";
import { useEffect, useRef, useState } from "react";

export function RevealOnScroll({ children, delay = 0, className = "" }: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}
      style={visible ? { animation: `reveal-up 0.6s ease forwards`, animationDelay: `${delay}ms` } : { opacity: 0 }}>
      {children}
    </div>
  );
}
