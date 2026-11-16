import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { getEnv } from "@/server/env";
import { runSync } from "@/server/sync";

// A sync takes about a minute. Never cache: every call must run.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

function allowed(req: NextRequest, secret: string): boolean {
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * The daily refresh, called by Vercel's scheduler (see vercel.json). Vercel sends CRON_SECRET as a bearer token, which
 * is the only thing that lets a caller in: there is no signed-in person on a scheduled run. Without CRON_SECRET the
 * route is closed to everyone.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ ok: false, reason: "The scheduled refresh is not set up: CRON_SECRET is missing." }, { status: 503 });
  if (!allowed(req, secret)) return NextResponse.json({ ok: false, reason: "Not allowed." }, { status: 401 });
  if (getEnv().DATA_ADAPTER === "mock") return NextResponse.json({ ok: false, reason: "No live source is configured (DATA_ADAPTER=mock), so there is nothing to refresh." }, { status: 409 });

  const result = await runSync("vercel-cron");
  if (result.ok) revalidatePath("/", "layout");
  else console.error(`[sync] scheduled refresh failed (${result.kind}): ${result.reason}`);
  // A real failure answers 500 so it shows as failed in Vercel's cron log. "Busy" and "cooldown" are not failures.
  return NextResponse.json(result, { status: result.ok ? 200 : result.kind === "error" || result.kind === "unavailable" ? 500 : 409 });
}
