import "server-only";
import { cached, clearCache } from "@/server/cache";
import { db } from "@/server/db";

/** Acknowledgements are read on every internal page, so they are cached briefly and cleared whenever this user acknowledges. */
const ACK_TTL_MS = 15_000;

export function ackedAlertKeys(userId: string): Promise<string[]> {
  return cached(`ack:${userId}`, ACK_TTL_MS, async () => (await db.alertAck.findMany({ where: { userId }, select: { alertKey: true } })).map((a) => a.alertKey));
}

export function forgetAckedAlertKeys(userId: string) {
  clearCache(`ack:${userId}`);
}
