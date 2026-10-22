import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission, toResponse } from "@/server/auth/guard";
import { db } from "@/server/db";

const body = z.object({ alertKey: z.string().min(1).max(200) });

export async function POST(req: Request) {
  try {
    const user = await requirePermission("portfolio:read");
    const { alertKey } = body.parse(await req.json());
    await db.alertAck.upsert({
      where: { alertKey_userId: { alertKey, userId: user.id } },
      create: { alertKey, userId: user.id },
      update: {},
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    return toResponse(e);
  }
}
