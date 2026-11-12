import "server-only";
import type { ActivityItem } from "@/lib/domain/types";
import { publish } from "../events";
import { newId } from "../ids";
import { mutate } from "../store";

/** Adds a line to the office feed and pushes it to every open back office. */
export function recordActivity(input: Omit<ActivityItem, "id" | "at">): ActivityItem {
  const item: ActivityItem = { id: newId(), at: new Date().toISOString(), ...input };
  mutate((db) => {
    db.activity.unshift(item);
  });
  publish(item);
  return item;
}
