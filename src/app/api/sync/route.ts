import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requirePermission, toResponse } from "@/server/auth/guard";
import { getEnv } from "@/server/env";
import { runSync } from "@/server/sync";

// A sync takes about a minute, longer than the default limit for a hosted function.
export const maxDuration = 300;

export async function POST() {
  try {
    const user = await requirePermission("sync:run");
    if (getEnv().DATA_ADAPTER === "mock") {
      return NextResponse.json({ ok: false, reason: "No live source is configured (DATA_ADAPTER=mock), so there is nothing to refresh." }, { status: 409 });
    }
    const result = await runSync(user.email);
    if (result.ok) revalidatePath("/", "layout");
    return NextResponse.json(result, { status: result.ok ? 200 : result.kind === "error" ? 500 : 409 });
  } catch (e) {
    return toResponse(e);
  }
}
