import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission, toResponse } from "@/server/auth/guard";
import { db } from "@/server/db";
import { ensureClientMapping } from "@/server/services/clients";

const body = z.object({ body: z.string().trim().min(1).max(4000) });

export async function POST(req: Request, { params }: { params: Promise<{ clientId: string }> }) {
  try {
    const user = await requirePermission("clients:notes:write");
    const { clientId } = await params;
    const { body: text } = body.parse(await req.json());
    await ensureClientMapping(clientId);
    const note = await db.note.create({ data: { clientId, authorId: user.id, body: text } });
    return NextResponse.json({ id: note.id }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    return toResponse(e);
  }
}
