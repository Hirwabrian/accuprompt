/**
 * Triggering gate — decides whether a given send is worth prompting on.
 *
 * THE PROBLEM
 * -----------
 * Detecting that a send happened is deterministic and already solved (the
 * interceptor catches the Send click / Enter keypress). But prompting on EVERY
 * send is noisy: most messages are "ok", "see you at 6", a thumbs-up. This gate
 * is the second decision — "is this share worth a reflection prompt?" — and it
 * sits between send-detection and showing the prompt.
 *
 * THE DESIGN STANCE: STRUCTURAL, NOT SEMANTIC (content-blind)
 * ----------------------------------------------------------
 * The gate reads the message's STRUCTURE, never its MEANING. It looks at length,
 * whether a link is present, whether digits are present, and (opportunistically)
 * the platform's "forwarded" provenance marker. It does NOT interpret topic,
 * match keywords, classify sentiment, or judge truth. Nothing is stored or
 * transmitted; the text is inspected locally and ephemerally and then discarded.
 *
 * The honest one-line framing for the write-up:
 *   "The gate inspects structural features of the outgoing message locally and
 *    ephemerally — length, link presence, numerals, and forwarded status — but
 *    does not read, interpret, store, or transmit message content."
 *
 * WHERE THE LINE IS
 * -----------------
 * "Does this message contain a number?"  -> structural  (we do this)
 * "Is this number a false statistic?"    -> semantic     (we do NOT)
 * A keyword/topic list or a claim classifier would cross into semantic reading;
 * those are deliberately left as future work (and would need a labelled
 * Kinyarwanda corpus that does not yet exist).
 *
 * POSTURE: "only prompt when claim-like" (the quieter end)
 * -------------------------------------------------------
 * Per the chosen posture, the gate is CONSERVATIVE: it stays silent unless the
 * message shows a positive structural signal of being claim-like. A bare short
 * message with no link, no numerals, and no forwarded marker does NOT trip the
 * gate. This errs toward under-prompting (missing some) rather than
 * over-prompting (nagging) — the trade chosen for the study.
 *
 * PLATFORM SEAM
 * -------------
 * The forwarded-status signal is platform-specific (it is a WhatsApp concept;
 * X's Repost is a different, even cleaner signal). The gate takes the structural
 * decision on text it is handed, and a separate, swappable `ForwardSignal`
 * function supplies the platform's provenance hint. Only WhatsApp is implemented
 * here; the seam is what a future X adapter would plug into.
 */

/** Tunable thresholds — one place to adjust the gate's behaviour. */
export const GATE_CONFIG = {
  /**
   * Below this many characters a message is treated as too trivial to be a
   * claim on its own (e.g. "ok", "thanks", "👍"). Short messages can still trip
   * the gate via a link, numerals, or forwarded status. Set to 30 so a terse
   * numeric assertion ("Putin's net worth is $250bn", ~30 chars) still counts,
   * while "meeting at 3pm" (~14) does not.
   */
  minClaimLengthChars: 30,
  /**
   * A message at/above this length is, on its own, structurally substantial
   * enough to be claim-like under the conservative posture.
   */
  substantialLengthChars: 120,
};

/** A platform's provenance hint: is the outgoing content forwarded/shared? */
export type ForwardSignal = () => boolean;

/** The structural signals we extracted, exposed for telemetry/explainability. */
export interface GateSignals {
  lengthChars: number;
  hasLink: boolean;
  hasNumerals: boolean;
  forwarded: boolean;
}

/** Decision plus the signals that produced it (so a decision is explainable). */
export interface GateDecision {
  prompt: boolean;
  /** Short, human-readable reason — useful for logs and the viva. */
  reason: string;
  signals: GateSignals;
}

// A URL-ish pattern. Structural only: detects that *a* link is present, never
// reads or resolves it.
const LINK_RE = /(https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(com|org|net|info|news|co|rw|io)\b/i;
// Any run of digits. Structural: detects that numerals exist, not what they mean.
const NUMERAL_RE = /\d/;

/** Extract the structural signals from a message and a forward hint. */
export function extractSignals(text: string, forwarded: boolean): GateSignals {
  const t = (text ?? '').trim();
  return {
    lengthChars: t.length,
    hasLink: LINK_RE.test(t),
    hasNumerals: NUMERAL_RE.test(t),
    forwarded,
  };
}

/**
 * The gate. Returns whether to prompt, with a reason and the signals.
 *
 * Conservative ("only prompt when claim-like") logic, in priority order:
 *   1. Forwarded content -> prompt. Forwarding is the strongest content-blind
 *      signal of *spreading* (vs authoring), and aligns with how misinformation
 *      propagates. (Opportunistic: only true if the platform exposes it.)
 *   2. Contains a link -> prompt. Shared links are a common misinformation vector.
 *   3. Substantial length AND contains numerals -> prompt. A longer message that
 *      cites figures is structurally claim-shaped (statistics, dates, counts).
 *   4. Very substantial length on its own -> prompt. A long message is more
 *      likely to be an assertion than a quick reply.
 *   5. Otherwise -> stay silent. Short, link-less, figure-less messages are
 *      treated as not-claim-like under the conservative posture.
 */
export function decide(text: string, forwarded: boolean): GateDecision {
  const s = extractSignals(text, forwarded);

  if (s.forwarded) {
    return { prompt: true, reason: 'forwarded content', signals: s };
  }
  if (s.hasLink) {
    return { prompt: true, reason: 'contains a link', signals: s };
  }
  if (s.lengthChars >= GATE_CONFIG.minClaimLengthChars && s.hasNumerals) {
    return { prompt: true, reason: 'substantial + cites figures', signals: s };
  }
  if (s.lengthChars >= GATE_CONFIG.substantialLengthChars) {
    return { prompt: true, reason: 'long message', signals: s };
  }
  return { prompt: false, reason: 'short / no claim signals', signals: s };
}

/**
 * Convenience used by the interceptor: read the compose text + forward hint,
 * decide, and return the decision. Kept here so the interceptor's only job is
 * wiring, not policy.
 *
 * `readText` and `forwardSignal` are injected so this stays testable and so the
 * platform seam is explicit — a future X adapter supplies its own pair.
 */
export function shouldPrompt(
  readText: () => string,
  forwardSignal: ForwardSignal,
): GateDecision {
  return decide(readText(), forwardSignal());
}
