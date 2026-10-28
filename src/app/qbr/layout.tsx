import { redirect } from "next/navigation";
import { signOut } from "@/server/auth";
import { ROLE_LABEL } from "@/server/auth/rbac";
import { loadQbr } from "@/server/dashboard/context";
import { QbrShell } from "@/components/dashboard/qbr-shell";

export default async function QbrLayout({ children }: { children: React.ReactNode }) {
  const q = await loadQbr({});

  async function doSignOut() {
    "use server";
    await signOut();
    redirect("/signin");
  }

  const user = q.ok ? q.ctx.user : q.user;
  const ctx = q.ok ? q.ctx : null;

  return (
    <QbrShell
      internal={ctx?.internal ?? false}
      userName={user.name ?? user.email}
      roleLabel={ROLE_LABEL[user.role]}
      clients={ctx?.clients ?? []}
      clientId={ctx?.data.clientId ?? null}
      clientName={ctx?.data.clientName ?? null}
      months={ctx?.months ?? []}
      range={ctx?.range ?? null}
      mock={ctx?.source === "mock"}
      asOf={ctx?.data.asOf ?? null}
      signOutAction={doSignOut}
    >
      {children}
    </QbrShell>
  );
}
