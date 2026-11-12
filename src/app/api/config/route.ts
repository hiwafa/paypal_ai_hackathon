import { connection } from "next/server";
import { runtimeConfig } from "@/lib/server/env";

// Which rails are live (PayPal sandbox or simulator, Claude or offline brain).
// Read per request so a deployment can add keys without rebuilding.
export async function GET() {
  await connection();
  return Response.json(runtimeConfig(), { headers: { "Cache-Control": "no-store" } });
}
