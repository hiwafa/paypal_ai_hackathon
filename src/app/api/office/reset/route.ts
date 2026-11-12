import { z } from "zod";
import { errorResponse, readJson } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rateLimit";
import { resetDb } from "@/lib/server/store";

// Restores the seeded week of history, e.g. right before recording a demo.
// It leaves no entry in the activity feed, so a fresh demo starts with the
// shop's own story rather than a note about resetting it.
export async function POST(request: Request) {
  try {
    enforceRateLimit(request, "reset", 3);
    await readJson(request, z.object({ confirm: z.literal("reset") }), 200);
    resetDb();
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
