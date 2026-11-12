import { connection } from "next/server";
import { subscribe } from "@/lib/server/events";

// Live feed for the back office (Server-Sent Events). Each event is one new
// activity item; the page animates the right robot and refreshes its data.
export async function GET(request: Request) {
  await connection();
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };

      send("retry: 3000\n\nevent: ready\ndata: {}\n\n");
      const unsubscribe = subscribe((item) => send(`event: activity\ndata: ${JSON.stringify(item)}\n\n`));
      // Comments keep proxies from closing an idle connection.
      const keepAlive = setInterval(() => send(": ping\n\n"), 15_000);

      cleanup = () => {
        clearInterval(keepAlive);
        unsubscribe();
      };
      request.signal.addEventListener(
        "abort",
        () => {
          cleanup();
          try {
            controller.close();
          } catch {
            // Already closed.
          }
        },
        { once: true },
      );
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
