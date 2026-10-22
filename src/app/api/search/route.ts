import { NextResponse } from "next/server";
import { requirePermission, toResponse } from "@/server/auth/guard";
import { getAdapters } from "@/server/data";

export async function GET(req: Request) {
  try {
    await requirePermission("clients:read");
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim().toLowerCase().slice(0, 100);
    const res = await getAdapters().analytics.listClients();
    if (res.status !== "ok") return NextResponse.json({ clients: [], unavailable: res.reason });
    const clients = res.data
      .filter((c) => c.name.toLowerCase().includes(q) || c.industry.toLowerCase().includes(q))
      .slice(0, 8)
      .map(({ id, name, industry }) => ({ id, name, industry }));
    return NextResponse.json({ clients });
  } catch (e) {
    return toResponse(e);
  }
}
