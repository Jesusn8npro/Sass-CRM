import { Navegacion, PieDePagina } from "@/app/_componentes-landing/Layout";
import "./blog.css";

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="landing-root" style={{ minHeight: "100vh" }}>
      <Navegacion />
      {children}
      <PieDePagina />
    </div>
  );
}
