/** Every Lampstand prayer ends the same way. */
export const PRAYER_CLOSE = "In Jesus' Name, Amen.";

/** Replaces any closing the model wrote ("Through Christ our Lord. Amen.") with ours. */
export function closePrayer(tail: string) {
  const body = tail
    .replace(/\s*(?:(?:in|through)\s+(?:the\s+name\s+of\s+)?(?:jesus|christ)[^.\n]*[.,]?\s*)?amen[.!]?\s*$/i, "")
    .replace(/\s*(?:in|through)\s+(?:the\s+name\s+of\s+)?jesus['’]?\s*(?:christ\s*)?(?:name)?[^.\n]{0,20}[.,]?\s*$/i, "")
    .trimEnd();
  return `${body}\n\n${PRAYER_CLOSE}`;
}
