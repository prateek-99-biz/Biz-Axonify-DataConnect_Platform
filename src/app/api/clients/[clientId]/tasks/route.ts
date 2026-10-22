import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission, toResponse } from "@/server/auth/guard";
import { db } from "@/server/db";
import { ensureClientMapping } from "@/server/services/clients";

const body = z.object({
  title: z.string().trim().min(1).max(200),
  detail: z.string().trim().max(4000).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  dueDate: z.string().date().optional(),
  ownerEmail: z.string().email().optional(),
  sourceAlertKey: z.string().max(200).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ clientId: string }> }) {
  try {
    const user = await requirePermission("clients:tasks:write");
    const { clientId } = await params;
    const input = body.parse(await req.json());
    await ensureClientMapping(clientId);
    const owner = input.ownerEmail ? await db.appUser.findUnique({ where: { email: input.ownerEmail.toLowerCase() } }) : null;
    if (input.ownerEmail && !owner) return NextResponse.json({ error: "Owner must be a signed-in Biz Group user" }, { status: 400 });
    const task = await db.task.create({
      data: {
        clientId, title: input.title, detail: input.detail, priority: input.priority,
        dueDate: input.dueDate ? new Date(input.dueDate) : null, ownerId: owner?.id ?? user.id,
        creatorId: user.id, sourceAlertKey: input.sourceAlertKey,
      },
    });
    return NextResponse.json({ id: task.id }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    return toResponse(e);
  }
}
