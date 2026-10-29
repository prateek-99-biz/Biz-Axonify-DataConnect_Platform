"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/primitives";
import { DataTable, type TableRow } from "@/components/tables/data-table";
import { unpackRows, type PackedRows } from "@/server/dashboard/sections";
import type { TrainingGroup } from "@/server/dashboard/types";
import { fmtNumber } from "@/lib/utils";

/** Rows are built here, not in the page, so the browser downloads plain data instead of a rendered node per cell. */
export function DeliveryTable({ groups, canExport }: { groups: PackedRows<TrainingGroup>; canExport: boolean }) {
  const rows: TableRow[] = useMemo(() => unpackRows(groups).map((g) => ({
    id: g.id,
    cells: {
      name: { v: g.name },
      status: { v: g.status, node: <Badge tone={g.status === "Active" ? "good" : "neutral"}>{g.status}</Badge> },
      programs: { v: g.programs, node: fmtNumber(g.programs) },
      reinforcement: { v: g.reinforcementTopics, node: fmtNumber(g.reinforcementTopics) },
    },
  })), [groups]);

  return (
    <DataTable canExport={canExport} exportName="training-groups" pageSize={12}
      columns={[{ key: "name", header: "Training group" }, { key: "status", header: "Status" }, { key: "programs", header: "Programs assigned", align: "right" }, { key: "reinforcement", header: "Reinforcement topics assigned", align: "right" }]}
      rows={rows} />
  );
}
