import { z } from "zod";
import { errorResponse, HttpError, readJson } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rateLimit";
import { decideApproval } from "@/lib/server/services/approvals";

const DecisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  via: z.enum(["click", "voice"]).default("click"),
});

// The owner's decision on something a robot prepared. Approving is the only
// way a supplier payout or a large refund ever reaches PayPal.
export async function POST(request: Request, ctx: RouteContext<"/api/office/approvals/[id]">) {
  try {
    enforceRateLimit(request, "approvals", 20);
    const { id } = await ctx.params;
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(400, "Invalid approval id.");
    const { decision, via } = await readJson(request, DecisionSchema, 1_000);
    return Response.json({ approval: await decideApproval(id, decision, via) });
  } catch (error) {
    return errorResponse(error);
  }
}
