import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const titulo = searchParams.get("titulo") ?? "Blog · Sass-CRM";
  const categoria = searchParams.get("categoria") ?? "";
  const autor = searchParams.get("autor") ?? "Equipo Sass-CRM";
  const tiempo = searchParams.get("tiempo") ?? "5";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: "linear-gradient(135deg, #09090b 0%, #0d1f18 50%, #09090b 100%)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 72px",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Glow orb */}
        <div
          style={{
            position: "absolute",
            top: "-100px",
            left: "-100px",
            width: "500px",
            height: "500px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(16,185,129,0.25) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        {/* Grid pattern */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.04,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
            backgroundSize: "50px 50px",
          }}
        />

        {/* Top: brand + category */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            zIndex: 1,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: "#10b981",
              }}
            />
            <span
              style={{
                fontFamily: "monospace",
                fontSize: "14px",
                color: "#10b981",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
              }}
            >
              Sass-CRM Blog
            </span>
          </div>
          {categoria && (
            <span
              style={{
                fontFamily: "monospace",
                fontSize: "12px",
                color: "#34d399",
                background: "rgba(16,185,129,0.1)",
                padding: "4px 14px",
                borderRadius: "999px",
                border: "1px solid rgba(52,211,153,0.3)",
              }}
            >
              {categoria}
            </span>
          )}
        </div>

        {/* Middle: title */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            zIndex: 1,
            padding: "32px 0",
          }}
        >
          <h1
            style={{
              fontSize: titulo.length > 60 ? "44px" : "56px",
              fontWeight: "800",
              color: "#fafafa",
              lineHeight: 1.1,
              margin: 0,
              letterSpacing: "-0.03em",
              maxWidth: "900px",
            }}
          >
            {titulo}
          </h1>
        </div>

        {/* Bottom: author + time */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            zIndex: 1,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: "rgba(16,185,129,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
                fontWeight: "700",
                color: "#34d399",
              }}
            >
              {autor[0]?.toUpperCase() ?? "A"}
            </div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: "600", color: "#e4e4e7" }}>
                {autor}
              </div>
              <div style={{ fontSize: "12px", color: "#71717a", fontFamily: "monospace" }}>
                {tiempo} min de lectura
              </div>
            </div>
          </div>
          <div style={{ fontSize: "13px", color: "#52525b", fontFamily: "monospace" }}>
            sass-crm.app
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
