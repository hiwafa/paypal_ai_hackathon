// Friendly timestamps in the viewer's own time zone.

const timeFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** "Today, 14:32", "Yesterday, 09:10" or "3 Nov, 16:05". */
export function formatWhen(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  const day = days === 0 ? "Today" : days === 1 ? "Yesterday" : dayFormat.format(date);
  return `${day}, ${timeFormat.format(date)}`;
}

/** "just now", "4 min ago", "3 h ago", then the date. */
export function timeAgo(iso: string, now = Date.now()): string {
  const ms = now - Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  if (ms < 45_000) return "just now";
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} min ago`;
  if (ms < 12 * 3_600_000) return `${Math.round(ms / 3_600_000)} h ago`;
  return formatWhen(iso, new Date(now));
}
