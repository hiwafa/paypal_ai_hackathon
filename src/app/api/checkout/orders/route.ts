import { errorResponse, readJson } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rateLimit";
import { CartSchema, createCheckout } from "@/lib/server/services/checkout";

// Creates a PayPal order (Orders v2) for the bag. Totals are computed on the
// server from the catalog; the browser only sends product ids and sizes.
export async function POST(request: Request) {
  try {
    enforceRateLimit(request, "checkout", 20);
    const cart = await readJson(request, CartSchema, 4_000);
    return Response.json(await createCheckout(cart));
  } catch (error) {
    return errorResponse(error);
  }
}
