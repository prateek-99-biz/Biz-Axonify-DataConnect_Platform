import { NextResponse } from "next/server";
import { requirePermission, toResponse } from "@/server/auth/guard";
import { accountsCsv } from "@/server/services/salesforce-accounts";

/** Downloads the client list as a CSV with whatever Salesforce data is already loaded filled in. Admin only. */
export async function GET() {
  try {
    await requirePermission("settings:manage");
    return new NextResponse(await accountsCsv(), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="salesforce-accounts.csv"', "Cache-Control": "no-store" },
    });
  } catch (e) {
    return toResponse(e);
  }
}
