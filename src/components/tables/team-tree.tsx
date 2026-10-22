"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TreeNode { id: string; name: string; parentId: string | null; registeredUsers: number; activeUsers: number }

function Row({ node, all, depth, defaultOpen }: { node: TreeNode; all: TreeNode[]; depth: number; defaultOpen: boolean }) {
  const kids = all.filter((n) => n.parentId === node.id);
  const [open, setOpen] = useState(defaultOpen);
  const eng = node.registeredUsers > 0 ? node.activeUsers / node.registeredUsers : null;
  return (
    <>
      <tr className="border-b border-line last:border-0">
        <td className="py-2 pr-4" style={{ paddingLeft: 16 + depth * 20 }}>
          {kids.length > 0 ? (
            <button className="inline-flex items-center gap-1 font-medium" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              {open ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}{node.name}
              <span className="text-xs font-normal text-slate-400">({kids.length})</span>
            </button>
          ) : <span className="pl-5">{node.name}</span>}
        </td>
        <td className="px-4 py-2 text-right tabular-nums">{node.registeredUsers.toLocaleString()}</td>
        <td className="px-4 py-2 text-right tabular-nums">{node.activeUsers.toLocaleString()}</td>
        <td className="px-4 py-2">
          <div className="flex items-center justify-end gap-2">
            <div className="h-1.5 w-24 rounded-full bg-slate-100" aria-hidden>
              <div className={cn("h-1.5 rounded-full", eng != null && eng < 0.35 ? "bg-warn" : "bg-brand")} style={{ width: `${Math.min(100, (eng ?? 0) * 100)}%` }} />
            </div>
            <span className="w-12 text-right tabular-nums">{eng == null ? "—" : `${(eng * 100).toFixed(1)}%`}</span>
          </div>
        </td>
      </tr>
      {open && kids.map((k) => <Row key={k.id} node={k} all={all} depth={depth + 1} defaultOpen={depth < 1} />)}
    </>
  );
}

export function TeamTree({ nodes }: { nodes: TreeNode[] }) {
  const roots = nodes.filter((n) => n.parentId === null);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line bg-slate-50 text-xs text-slate-500">
            <th scope="col" className="px-4 py-2 text-left font-medium">Team</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">Registered</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">Active</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">Engagement</th>
          </tr>
        </thead>
        <tbody>{roots.map((r) => <Row key={r.id} node={r} all={nodes} depth={0} defaultOpen />)}</tbody>
      </table>
    </div>
  );
}
