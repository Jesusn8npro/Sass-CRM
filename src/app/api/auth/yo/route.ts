import { NextResponse } from "next/server";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ id: auth.id, email: auth.email });
}
