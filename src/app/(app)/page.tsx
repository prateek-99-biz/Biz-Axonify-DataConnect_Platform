import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { getAdapters } from "@/server/data";
import { homePathFor } from "@/server/services/accounts";

/** The front door: a CSM goes to their own accounts, everyone else to the portfolio. */
export default async function Home() {
  const session = await auth();
  const clients = await getAdapters().analytics.listClients();
  redirect(session?.user && clients.status === "ok" ? homePathFor(session.user.email, clients.data) : "/portfolio");
}
