"use client";

import { useEffect } from "react";
import { receiveActivity, refreshOffice } from "@/lib/client/office";
import { useOffice } from "@/lib/client/officeStore";
import type { ActivityItem } from "@/lib/domain/types";

const POLL_MS = 15_000;

function isActivity(value: unknown): value is ActivityItem {
  const item = value as Partial<ActivityItem> | null;
  return (
    typeof item?.id === "string" &&
    typeof item.at === "string" &&
    typeof item.kind === "string" &&
    typeof item.actor === "string" &&
    typeof item.title === "string"
  );
}

/**
 * Keeps the back office live: Server-Sent Events push every new activity, and
 * a slow poll takes over if a proxy ever blocks the stream.
 */
export function useOfficeFeed() {
  useEffect(() => {
    let source: EventSource | null = null;
    let retry: number | undefined;
    let disposed = false;

    const connect = () => {
      source = new EventSource("/api/office/events");
      source.addEventListener("ready", () => {
        useOffice.getState().patch({ live: true });
        // Catch up on anything missed while disconnected.
        void refreshOffice();
      });
      source.addEventListener("activity", (event) => {
        try {
          const item: unknown = JSON.parse((event as MessageEvent<string>).data);
          if (isActivity(item)) receiveActivity(item);
        } catch {
          // A malformed event is skipped; the next refresh brings the truth.
        }
      });
      source.onerror = () => {
        useOffice.getState().patch({ live: false });
        // The browser retries on its own unless the stream was closed for good.
        if (source?.readyState === EventSource.CLOSED && !disposed) {
          retry = window.setTimeout(connect, 5_000);
        }
      };
    };

    connect();
    const poll = window.setInterval(() => {
      if (!useOffice.getState().live) void refreshOffice();
    }, POLL_MS);
    const onFocus = () => void refreshOffice();
    window.addEventListener("focus", onFocus);

    return () => {
      disposed = true;
      window.clearTimeout(retry);
      window.clearInterval(poll);
      window.removeEventListener("focus", onFocus);
      source?.close();
      useOffice.getState().patch({ live: false });
    };
  }, []);
}
