import { connection } from "next/server";
import type { OfficeState } from "@/lib/domain/api";
import { runtimeConfig } from "@/lib/server/env";
import { readDb } from "@/lib/server/store";

// Everything the back office renders. KPIs are computed in the browser so
// "today" follows the owner's own time zone.
export async function GET() {
  await connection();
  const db = readDb();
  const state: OfficeState = {
    ledger: db.ledger.slice(0, 500),
    approvals: db.approvals.slice(0, 40),
    bills: db.bills,
    activity: db.activity.slice(0, 80),
    claims: db.claims.slice(0, 12),
    config: runtimeConfig(),
  };
  return Response.json(state, { headers: { "Cache-Control": "no-store" } });
}
