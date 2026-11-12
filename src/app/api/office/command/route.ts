import { z } from "zod";
import { safeTimeZone } from "@/lib/domain/kpis";
import { runCrewCommand } from "@/lib/server/ai/crew";
import { errorResponse, readJson } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rateLimit";

const CommandSchema = z.object({
  text: z.string().trim().min(2).max(400),
  timeZone: z.string().max(64).optional(),
});

// A typed or spoken instruction from the owner to the crew.
export async function POST(request: Request) {
  try {
    enforceRateLimit(request, "command", 12);
    const { text, timeZone } = await readJson(request, CommandSchema, 2_000);
    return Response.json(await runCrewCommand(text, safeTimeZone(timeZone)));
  } catch (error) {
    return errorResponse(error);
  }
}
