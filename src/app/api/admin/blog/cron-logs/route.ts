import { NextResponse } from "next/server";
import { requerirAdmin } from "@/lib/auth/sesion";
import { listarRunsCron } from "@/lib/db/blogCronRuns";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requerirAdmin();
  if (auth instanceof NextResponse) return auth;

  const runs = await listarRunsCron(100);
  return NextResponse.json({ runs });
}
