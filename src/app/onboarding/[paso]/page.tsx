import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { obtenerUsuarioActual } from "@/lib/auth/sesion";
import { listarCuentas } from "@/lib/baseDatos";
import { BarraProgreso } from "../_componentes/BarraProgreso";
import { PasoConectar } from "../_componentes/PasoConectar";
import { PasoPlantilla } from "../_componentes/PasoPlantilla";
import { PasoProductos } from "../_componentes/PasoProductos";
import { PasoProbar } from "../_componentes/PasoProbar";

const PASOS_NUM: Record<string, 1 | 2 | 3 | 4> = {
  conectar: 1,
  plantilla: 2,
  productos: 3,
  probar: 4,
};

/**
 * Renderiza el componente correcto del paso. El componente cliente se
 * encarga de redireccionar al siguiente paso cuando termina.
 */
export default async function PaginaPasoOnboarding({
  params,
}: {
  params: Promise<{ paso: string }>;
}) {
  const { paso } = await params;
  const num = PASOS_NUM[paso];
  if (!num) notFound();

  const auth = await obtenerUsuarioActual();
  if (!auth) redirect(`/login?siguiente=/onboarding/${paso}`);

  const cuentas = await listarCuentas(auth.id);

  // Pasos 2/3/4 requieren tener al menos una cuenta. Si no, redirigimos
  // al paso 1.
  if (paso !== "conectar" && cuentas.length === 0) {
    redirect("/onboarding/conectar");
  }

  const cuenta = cuentas[0] ?? null;

  // Para paso 1: pre-renderizamos QR si la cuenta lo tiene, para que
  // aparezca al primer render sin esperar el polling.
  let cuentaInicial: {
    id: string;
    etiqueta: string;
    estado: "desconectado" | "qr" | "conectando" | "conectado";
    telefono: string | null;
    cadena_qr?: string | null;
    qr_png?: string | null;
  } | null = null;

  if (cuenta) {
    let qr_png: string | null = null;
    if (
      cuenta.cadena_qr &&
      (cuenta.estado === "qr" || cuenta.estado === "conectando")
    ) {
      try {
        qr_png = await QRCode.toDataURL(cuenta.cadena_qr, {
          width: 320,
          margin: 2,
          color: { dark: "#fafafa", light: "#0a0a0a" },
        });
      } catch {
        qr_png = null;
      }
    }
    cuentaInicial = {
      id: cuenta.id,
      etiqueta: cuenta.etiqueta,
      estado: cuenta.estado,
      telefono: cuenta.telefono,
      cadena_qr: cuenta.cadena_qr,
      qr_png,
    };
  }

  return (
    <>
      <BarraProgreso pasoActual={num} />
      {paso === "conectar" && (
        <PasoConectar cuentaInicial={cuentaInicial} />
      )}
      {paso === "plantilla" && cuenta && (
        <PasoPlantilla idCuenta={cuenta.id} />
      )}
      {paso === "productos" && cuenta && (
        <PasoProductos idCuenta={cuenta.id} />
      )}
      {paso === "probar" && cuenta && <PasoProbar idCuenta={cuenta.id} />}
    </>
  );
}
