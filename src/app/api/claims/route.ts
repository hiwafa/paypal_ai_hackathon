import { errorResponse, readJson } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rateLimit";
import { ClaimSchema, fileClaim } from "@/lib/server/services/claims";

// A customer reports damage with a photo; Kai assesses it and the care policy
// decides between an instant refund, the owner's approval or a better photo.
export async function POST(request: Request) {
  try {
    enforceRateLimit(request, "claims", 6);
    const input = await readJson(request, ClaimSchema, 5_200_000);
    return Response.json({ claim: await fileClaim(input) });
  } catch (error) {
    return errorResponse(error);
  }
}
