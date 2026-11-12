import { z } from "zod";
import { safeTimeZone } from "@/lib/domain/kpis";
import { writeBriefing } from "@/lib/server/ai/briefing";
import { errorResponse, readJson } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rateLimit";
import { recordActivity } from "@/lib/server/services/activity";

const BriefingRequest = z.object({ timeZone: z.string().max(64).optional() });

export async function POST(request: Request) {
  try {
    enforceRateLimit(request, "briefing", 6);
    const { timeZone } = await readJson(request, BriefingRequest, 1_000);
    const briefing = await writeBriefing(safeTimeZone(timeZone));
    recordActivity({ kind: "briefing", actor: "penny", title: "Shared the daily briefing", detail: briefing.headline });
    return Response.json(briefing);
  } catch (error) {
    return errorResponse(error);
  }
}
