import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission, toResponse } from "@/server/auth/guard";
import { db } from "@/server/db";

const body = z.object({ status: z.enum(["OPEN", "IN_PROGRESS", "DONE", "CANCELLED"]) });

export async function PATCH(req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    await requirePermission("clients:tasks:write");
    const { taskId } = await params;
    const { status } = body.parse(await req.json());
    const task = await db.task.update({ where: { id: taskId }, data: { status } }).catch(() => null);
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    return toResponse(e);
  }
}
