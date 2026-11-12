import { z } from "zod";
import { askStylist } from "@/lib/server/ai/stylist";
import { errorResponse, readJson } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rateLimit";
import { FACE_SHAPES, FRAME_SIZES, PRODUCT_IDS } from "@/lib/domain/types";

const RequestSchema = z.object({
  turns: z
    .array(
      z.object({
        role: z.enum(["customer", "lumi", "event"]),
        text: z.string().trim().min(1).max(600),
      }),
    )
    .min(1)
    .max(30),
  state: z.object({
    face: z
      .object({
        shape: z.enum(FACE_SHAPES),
        widthMm: z.number().min(80).max(240).nullable(),
        recommendedSize: z.enum(FRAME_SIZES),
        confidence: z.number().min(0).max(1),
        source: z.enum(["camera", "manual"]),
      })
      .nullable(),
    bag: z
      .array(
        z.object({
          productId: z.enum(PRODUCT_IDS),
          size: z.enum(FRAME_SIZES),
          quantity: z.number().int().min(1).max(3),
        }),
      )
      .max(6),
    onCounter: z.array(z.enum(PRODUCT_IDS)).max(4),
    tryingOn: z.enum(PRODUCT_IDS).nullable(),
    mirrorOpen: z.boolean(),
  }),
});

export async function POST(request: Request) {
  try {
    enforceRateLimit(request, "stylist", 30);
    const body = await readJson(request, RequestSchema, 24_000);
    return Response.json(await askStylist(body));
  } catch (error) {
    return errorResponse(error);
  }
}
