import { Navegacion, PieDePagina } from "@/app/_componentes-landing/Layout";

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950">
      <Navegacion />
      {children}
      <PieDePagina />
    </div>
  );
}
