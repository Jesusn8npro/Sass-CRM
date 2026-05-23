import { NextResponse } from "next/server";
import { requerirAdmin } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

const _g = global as typeof global & {
  __cronBlogSlotsHoy?: Set<string>;
  __cronBlogDiaHoy?: number;
};

export async function POST() {
  const auth = await requerirAdmin();
  if (auth instanceof NextResponse) return auth;

  const cantidad = _g.__cronBlogSlotsHoy?.size ?? 0;
  _g.__cronBlogSlotsHoy = new Set();
  _g.__cronBlogDiaHoy = undefined;

  return NextResponse.json({ ok: true, slotsLimpiados: cantidad });
}
