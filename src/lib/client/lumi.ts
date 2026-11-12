"use client";

import { getProduct } from "@/lib/domain/catalog";
import { formatMoney } from "@/lib/domain/money";
import type { CheckoutSummary } from "@/lib/domain/api";
import type { ChatTurn, Mood, StylistAction } from "@/lib/domain/stylist";
import type { FaceProfile, ProductId } from "@/lib/domain/types";
import { api } from "./api";
import { useShop } from "./shopStore";
import { speak } from "./speech";

// Lumi's conversation loop: send the chat and shop state to the stylist API,
// then turn the reply into speech, an expression and UI actions.

export const GREETING_SUGGESTIONS = ["Sunglasses for summer", "Everyday frames", "What suits my face?"];

/** Lumi says something out loud and adds it to the chat. */
export function say(text: string, mood: Mood = "happy") {
  const shop = useShop.getState();
  shop.pushTurn({ role: "lumi", text });
  shop.patch({ mood });
  speak(text, "lumi", {
    onStart: () => useShop.getState().patch({ activity: "speaking" }),
    onEnd: () => {
      const { activity } = useShop.getState();
      if (activity === "speaking") useShop.getState().patch({ activity: "idle" });
    },
  });
}

export function greet() {
  const shop = useShop.getState();
  shop.playGesture("wave");
  say(
    "Hi, welcome to Mira Eyewear! I'm Lumi, your stylist. Are you looking for sunglasses, or frames for every day?",
    "happy",
  );
  shop.patch({ suggestions: GREETING_SUGGESTIONS });
}

function applyActions(actions: StylistAction[]) {
  const shop = useShop.getState();
  for (const action of actions) {
    switch (action.type) {
      case "show_frames":
        shop.showFrames(action.productIds);
        shop.playGesture("present");
        break;
      case "open_mirror":
        shop.openPanel("mirror");
        break;
      case "try_on":
        shop.tryOn(action.productId);
        shop.openPanel("mirror");
        break;
      case "add_to_bag":
        shop.addToBag(action.productId, action.size);
        shop.playGesture("celebrate");
        break;
      case "remove_from_bag":
        shop.removeFromBag(action.productId);
        break;
      case "open_checkout":
        shop.openPanel("bag");
        break;
    }
  }
}

/** An app event that arrived while Lumi was still answering; sent right after. */
let queuedEvent: ChatTurn | null = null;

/** Sends one customer message (or app event) to Lumi and plays the reply. */
export async function talkToLumi(turn: ChatTurn) {
  const shop = useShop.getState();
  if (shop.busy) {
    if (turn.role === "event") queuedEvent = turn;
    return;
  }
  shop.pushTurn(turn);
  shop.patch({ busy: true, activity: "thinking", suggestions: [] });

  try {
    const state = useShop.getState();
    const reply = await api.stylist({
      turns: state.turns.slice(-20),
      state: {
        face: state.face,
        bag: state.bag,
        onCounter: state.onCounter,
        tryingOn: state.tryingOn,
        mirrorOpen: state.mirror === "live" || state.mirror === "mannequin",
      },
    });
    applyActions(reply.actions);
    say(reply.say, reply.mood);
    useShop.getState().patch({ suggestions: reply.suggestions });
  } catch {
    say("Sorry, my circuits got tangled for a second. Could you say that again?", "caring");
  } finally {
    const { activity } = useShop.getState();
    useShop.getState().patch({ busy: false, activity: activity === "thinking" ? "idle" : activity });
    if (queuedEvent) {
      const next = queuedEvent;
      queuedEvent = null;
      void talkToLumi(next);
    }
  }
}

/** The mirror finished measuring: let Lumi react with tailored picks. */
export function reportFaceReading(face: FaceProfile) {
  useShop.getState().patch({ face });
  const width = face.widthMm ? `${face.widthMm} mm wide` : "width unknown";
  void talkToLumi({
    role: "event",
    text:
      face.source === "manual"
        ? `Manual face reading: without a camera, the customer chose a ${face.shape} face shape on the mannequin.`
        : `The magic mirror finished the face reading: ${face.shape} face (${Math.round(face.confidence * 100)}% confidence), ${width}, recommended size ${face.recommendedSize}.`,
  });
}

export function celebratePayment(summary: CheckoutSummary) {
  const shop = useShop.getState();
  shop.recordOrder(summary);
  shop.playGesture("celebrate");
  const firstName = summary.payerName.split(" ")[0] || "friend";
  const frames = summary.lines.map((l) => getProduct(l.productId).name).join(" and ");
  say(
    `Thank you, ${firstName}! ${frames} ${summary.lines.length > 1 ? "are" : "is"} paid, ${formatMoney(summary.totalCents)} with PayPal. Your order number is ${summary.number}. If anything ever happens to your frames, Kai at the care desk will look after you.`,
    "excited",
  );
  shop.patch({ suggestions: ["What's the care policy?", "Keep browsing"] });
}

const PICK_LINES = [
  (name: string, look: string, fit: string) => `${name}: ${look}.${fit} Want to see it on you in the mirror?`,
  (name: string, look: string, fit: string) => `Good eye! ${name}, ${look}.${fit}`,
  (name: string, look: string, fit: string) =>
    `${name} it is: ${look}.${fit} Tap Try on and the mirror will fit it to your face.`,
];
let pickCount = 0;

/** An instant line when the customer picks a frame from the wall; no AI round trip needed. */
export function introduceFrame(id: ProductId) {
  const shop = useShop.getState();
  if (shop.busy) return;
  const product = getProduct(id);
  const look = product.tagline.replace(" · ", ", ").toLowerCase();
  const fit =
    shop.face && product.suits.includes(shop.face.shape) ? ` It flatters your ${shop.face.shape} face, too.` : "";
  shop.playGesture("present");
  say(PICK_LINES[pickCount++ % PICK_LINES.length](product.name, look, fit), "curious");
}

/** "Add" on a counter tag: bag it in the size the mirror recommended. */
export function addFromCounter(id: ProductId) {
  const shop = useShop.getState();
  const size = shop.face?.recommendedSize ?? "M";
  const product = getProduct(id);
  shop.addToBag(id, size);
  shop.playGesture("celebrate");
  if (!shop.busy) {
    say(`Lovely choice! ${product.name} in size ${size} is in your bag.`, "excited");
    shop.patch({ suggestions: ["Check out with PayPal", "Show me something else"] });
  }
}

/** "Try on" on a counter tag: open the mirror with this frame on. */
export function tryOnFrame(id: ProductId) {
  const shop = useShop.getState();
  const opening = shop.mirror === "closed";
  shop.tryOn(id);
  shop.openPanel("mirror");
  if (opening && !shop.busy) say(`Let's see ${getProduct(id).name} on you!`, "excited");
}

/** The vanity mirror on the counter was clicked. */
export function openMirror() {
  const shop = useShop.getState();
  if (shop.mirror !== "closed") return;
  shop.openPanel("mirror");
  if (!shop.busy) {
    say(
      "Step up to the magic mirror! It measures your face right here on your device; I only get the numbers.",
      "curious",
    );
  }
}
