import { NextResponse } from "next/server";
import { requerirAdmin } from "@/lib/auth/sesion";
import type { CronBlogStatus } from "@/instrumentation";
import { horaBogota } from "@/lib/db/blogConfig";

export const dynamic = "force-dynamic";

const _g = global as typeof global & {
  __cronBlogActivo?: boolean;
  __cronBlogStatus?: CronBlogStatus;
};

export async function GET() {
  const auth = await requerirAdmin();
  if (auth instanceof NextResponse) return auth;

  const status = _g.__cronBlogStatus ?? null;
  const { hora, min, dia } = horaBogota();

  return NextResponse.json({
    corriendo: _g.__cronBlogActivo === true,
    status,
    ahoraUTC: {
      hora,
      minuto: min,
      dia,
      iso: new Date().toISOString(),
    },
  });
}
