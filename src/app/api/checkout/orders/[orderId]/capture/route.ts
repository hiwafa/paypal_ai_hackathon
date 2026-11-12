import { errorResponse, HttpError } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rateLimit";
import { captureCheckout } from "@/lib/server/services/checkout";

// Captures an order after the buyer approved it in PayPal's window.
export async function POST(request: Request, ctx: RouteContext<"/api/checkout/orders/[orderId]/capture">) {
  try {
    enforceRateLimit(request, "capture", 20);
    const { orderId } = await ctx.params;
    if (!/^[A-Za-z0-9-]{6,40}$/.test(orderId)) throw new HttpError(400, "Invalid order id.");
    return Response.json(await captureCheckout(orderId));
  } catch (error) {
    return errorResponse(error);
  }
}
