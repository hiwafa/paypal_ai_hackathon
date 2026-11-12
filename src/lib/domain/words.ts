// Small helpers that keep the robots' English natural.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "1 order", "3 orders". */
export function plural(n: number, singular: string, many = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : many}`;
}

/** A calendar day such as "2026-11-12" as "12 Nov". Pure date math, so no time zone can shift it. */
export function shortDate(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date || month > 12) return day;
  return `${date} ${MONTHS[month - 1]}`;
}
