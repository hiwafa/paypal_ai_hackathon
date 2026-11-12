# Devpost submission: CrewOS

Copy each block into the matching field of the Devpost form.

---

## Project name

```
CrewOS
```

## Elevator pitch

```
A robot crew for one-person shops: AI agents sell, keep the books, pay suppliers and refund customers through PayPal, and no money moves without the owner's OK.
```

## About the project

```markdown
## Inspiration

A one-person shop owner does every job alone: shop assistant, bookkeeper, accounts payable and customer care. The money work is the part that keeps them up at night. It is too risky to hand to a chatbot, and too small a business to hire for. We wanted to see what it looks like when AI does the legwork but the owner keeps the final say on every cent.

## What it does

CrewOS gives Maryam, who runs Mira Eyewear in Lisbon on her own, a crew of four robots:

- **Lumi, the stylist**, greets customers in a 3D boutique. She talks with them in plain language and reads their face shape in an AR magic mirror that runs on the device. Then she suggests frames, and the customer pays with the PayPal button.
- **Penny, the bookkeeper**, books every PayPal capture with the fee PayPal actually charged. She keeps a live ledger and reads Maryam a daily briefing.
- **Otto, the treasurer**, prepares supplier payouts when Maryam asks ("Pay Lens Lab"). He sends them through PayPal Payouts only after she approves, by click or by voice.
- **Kai, customer care**, looks at a customer's photo of damaged frames and applies the shop's care policy. A cosmetic scratch gets an instant 15% refund through PayPal, while bigger amounts wait for Maryam.

The customer only ever sees the boutique. Maryam's back office reacts within about a second as PayPal confirms each payment.

## How we built it

- **Next.js 16 and React 19**, with the boutique and crew room in **three.js / React Three Fiber** and the face reading done by **MediaPipe** in the browser.
- **PayPal sandbox:**
  - Orders v2 checkout through the JS SDK v6 button.
  - Payouts for suppliers, polled until PayPal confirms them.
  - Refunds made only against the original capture.
  - Signature-verified webhooks.
  - Every money call carries a `PayPal-Request-Id`, and every payout batch has a stable `sender_batch_id`, so a retry can never pay twice.
- **Claude Opus 5.5 through the Anthropic SDK:**
  - Structured output for Lumi.
  - A tool runner over seven narrow tools for the crew console.
  - Vision for Kai's claim photos.
  - Penny's briefing, written from figures the server has already computed.
- **AG Grid** for the ledger, with:
  - live row updates as PayPal events land
  - quick search
  - a pinned totals row
  - CSV export
- **Zod** validates every request body and every model output.

The design rule throughout: **AI proposes, code decides, the owner approves.** No tool the model can call moves money. Refund amounts come from a coded care policy, and voice approval is matched by plain code in the owner's browser, never by the model.

## Challenges we ran into

- Keeping AI off the money path while still making the crew feel useful. The answer was to let Claude prepare a request and leave the decision to the owner.
- Exactly-once payments when networks retry: idempotency keys on every call and stable payout batch IDs.
- Reconciling fees correctly from PayPal's `seller_receivable_breakdown` instead of guessing them.
- Two windows of one browser share a single speech engine, so the robots in the shop and the office kept cutting each other off. They now take turns over a BroadcastChannel.

## Accomplishments that we're proud of

- The whole story runs end to end on real PayPal sandbox APIs: a sale, a supplier payout and a photo-based refund, each with a PayPal ID in the ledger.
- A complete product rather than a single demo screen: a customer-facing boutique and an owner's back office, each logical from its user's point of view.
- It also runs with no keys at all, through a built-in PayPal simulator and an offline brain, so anyone can try it in two minutes.

## What we learned

The model is at its best when it is boxed in: narrow tools, validated structured output, and numbers computed in code. Trust comes from making the safe path the only path.

## What's next

- Sign-in for the back office.
- More payment rails from the PayPal platform (Venmo, Pay Later).
- Inventory reordering from sales trends.
- Packaging the crew so any small shop can plug in its own catalog.
```

## Built with

```
next.js, react, typescript, three.js, react-three-fiber, mediapipe, claude, anthropic-sdk, paypal, paypal-orders-v2, paypal-payouts, paypal-refunds, paypal-webhooks, ag-grid, zod, zustand, tailwindcss
```

## Try it out links

```
https://github.com/hiwafa/paypal_ai_hackathon
https://youtu.be/m3g_evf6TgA
```

## Video demo link

```
https://youtu.be/m3g_evf6TgA
```

## AI tools used (if the form asks)

```
Inside the product: Claude Opus 5.5 through the Anthropic API powers Lumi's conversation, the crew console's tool use, Kai's photo assessment and Penny's daily briefing. MediaPipe Face Landmarker runs on the device for the magic mirror.

To build it: Claude Code (Anthropic) was used as a coding assistant for writing and reviewing code, tests in the browser, and the video edit.
```

## Testing instructions (if the form asks)

```
No logins or keys are needed: run "npm install" and "npm run dev", then open http://localhost:3000. Without keys, a built-in PayPal simulator and an offline brain run the same flows.

To use the real PayPal sandbox and Claude, add your own sandbox REST app credentials and an Anthropic API key to .env.local, as described in the README section "Connect PayPal and Claude".

Open /shop and /office side by side with sound on. Buy a pair in the boutique and watch the back office book it as PayPal confirms.
```
