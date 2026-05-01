import { NextResponse, type NextRequest } from "next/server";
import { listarVoces } from "@/lib/elevenlabs";

export const dynamic = "force-dynamic";

/**
 * Lista todas las voces visibles para esta API key:
 * premade (default), cloned (las que clonaste), professional, generated.
 * El front las agrupa por category.
 */
export async function GET(_req: NextRequest) {
  try {
    const voces = await listarVoces();
    return NextResponse.json({ voces });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: detalle.slice(0, 500) },
      { status: 502 },
    );
  }
}
