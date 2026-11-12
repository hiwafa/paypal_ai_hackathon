// Money is always handled as integer cents. Floats only appear at the edges:
// when we format for people or serialize for PayPal's string amounts.

export const CURRENCY = "USD";

const formatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: CURRENCY,
});

export function formatMoney(cents: number): string {
  return formatter.format(cents / 100);
}

/** Formats a signed amount with an explicit sign, e.g. "+$148.00" / "−$22.20". */
export function formatSigned(cents: number): string {
  if (cents === 0) return formatMoney(0);
  const sign = cents > 0 ? "+" : "−";
  return `${sign}${formatMoney(Math.abs(cents))}`;
}

/** PayPal expects amounts as decimal strings with two fraction digits. */
export function toPayPalValue(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new Error(`Invalid amount in cents: ${cents}`);
  }
  return (cents / 100).toFixed(2);
}

/** Parses PayPal's "148.00" style amounts back into integer cents. */
export function fromPayPalValue(value: string | undefined | null): number {
  if (!value) return 0;
  const match = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) throw new Error(`Unexpected PayPal amount: ${value}`);
  const [, minus, whole, fraction = ""] = match;
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return minus ? -cents : cents;
}

export function percentOf(cents: number, rate: number): number {
  return Math.round(cents * rate);
}
