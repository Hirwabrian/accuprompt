/**
 * Platform adapters.
 *
 * The interceptor (interceptor.ts) is platform-independent: it knows how to run
 * a capture-phase click/Enter listener, run the gate, and show the prompt. What
 * differs per platform is (a) how to recognise a send action, (b) where the
 * compose text lives, and (c) whether a "forwarded/shared" signal is available.
 * Each PlatformAdapter supplies exactly those pieces. This is the seam the
 * proposal refers to: adding a platform means adding an adapter, not touching
 * the interceptor engine.
 *
 * IMPLEMENTED: WhatsApp Web (foundational, live-verified).
 * ADDED, PENDING LIVE VERIFICATION: Facebook Messenger. Its selectors are a
 * best-effort structural guess and MUST be checked against the live messenger.com
 * DOM before relying on them — Meta ships obfuscated, frequently-changing markup.
 * The `SELECTOR NOTE` comments flag exactly what to verify.
 */

export interface PlatformAdapter {
  /** Short id, also used as the telemetry platform value. */
  id: 'whatsapp' | 'messenger' | 'x' | 'facebook';
  /** Does this adapter apply to the current page? (hostname match) */
  matches: (host: string) => boolean;
  /** Is this event target the send control (or inside it)? */
  isSendTarget: (target: Element) => boolean;
  /** Is this event target inside the real message compose box? */
  isInComposeBox: (target: Element) => boolean;
  /** Read the current compose text (used by gate + RAG). Never throws. */
  readComposeText: () => string;
  /** Opportunistic "forwarded / shared" signal. Returns false when absent. */
  forwardedSignal: () => boolean;
  /**
   * Does this keypress mean "send" on this platform? WhatsApp/Messenger send on
   * plain Enter (Shift+Enter = newline); X inserts a newline on Enter and sends
   * on Ctrl/Cmd+Enter. Defining it per-adapter keeps the engine platform-neutral.
   */
  isSendKey: (e: KeyboardEvent) => boolean;
  /**
   * OPTIONAL. Is this click a "share a post to a private message" action (the
   * Send-in-DM / Send-in-Messenger option in a post's share menu)? This is the
   * interpersonal-forwarding moment we want to prompt on — but the content being
   * shared is the ORIGINAL POSTER's, not the user's own text. So when this
   * returns true, the engine fires the prompt CONTENT-BLIND: it does NOT read the
   * shared post and does NOT run retrieval, regardless of the RAG toggle. Reading
   * the shared post's text for RAG is deliberately out of scope (separate
   * future-work decision about third-party content). Adapters without a share
   * action omit this.
   */
  isShareAction?: (target: Element) => boolean;
}

/** Plain Enter, no modifiers (WhatsApp / Messenger). */
function plainEnter(e: KeyboardEvent): boolean {
  return e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey;
}

/** Ctrl/Cmd + Enter (X). */
function modEnter(e: KeyboardEvent): boolean {
  return e.key === 'Enter' && (e.ctrlKey || e.metaKey);
}

/* ================================================================== *
 * WhatsApp Web — foundational, live-verified.
 * Observed on web.whatsapp.com (June 2026). Obfuscated class names are
 * intentionally avoided; only semantic attributes are used.
 * ================================================================== */
const WA = {
  sendButton: 'button[aria-label="Send"]',
  sendIcon: '[data-icon="wds-ic-send-filled"]',
  composeBox: 'div[contenteditable="true"][role="textbox"]',
  footer: 'footer',
  forwardedMarker: '[data-icon="forwarded"], span[aria-label="Forwarded"]',
};

export const whatsapp: PlatformAdapter = {
  id: 'whatsapp',
  matches: (host) => host.endsWith('web.whatsapp.com'),
  isSendTarget: (target) => {
    if (target.closest(WA.sendButton)) return true;
    const icon = target.closest(WA.sendIcon);
    return !!(icon && icon.closest('button'));
  },
  isInComposeBox: (target) => {
    const box = target.closest(WA.composeBox);
    if (!box) return false;
    // Require the footer so the chat-search box doesn't trigger.
    return !!box.closest(WA.footer);
  },
  readComposeText: () => {
    const boxes = document.querySelectorAll(WA.composeBox);
    for (const box of Array.from(boxes)) {
      if (box.closest(WA.footer)) return (box as HTMLElement).innerText.trim();
    }
    return '';
  },
  forwardedSignal: () => {
    try {
      const footer = document.querySelector(WA.footer);
      return !!(footer ?? document).querySelector(WA.forwardedMarker);
    } catch {
      return false;
    }
  },
  isSendKey: plainEnter,
};

/* ================================================================== *
 * Facebook Messenger — ADDED, PENDING LIVE VERIFICATION.
 *
 * Messenger is the closest analog to WhatsApp: interpersonal, message-based,
 * text-carrying (so the retrieval panel still works). The interception pattern
 * is identical; only the selectors differ. Meta's DOM is heavily obfuscated,
 * so these use ARIA/role attributes wherever possible and WILL need checking.
 *
 * SELECTOR NOTES (verify each on live messenger.com):
 *  - Compose box: Messenger uses a contenteditable with role="textbox" and an
 *    aria-label that has historically been "Message" (localised). We match the
 *    role and, as a guard, prefer one whose aria-label contains "message".
 *  - Send button: an aria-label="Send" / "Press enter to send" button that
 *    appears when there is text. Enter also sends (Shift+Enter = newline), same
 *    as WhatsApp.
 *  - Forwarded/shared: Messenger's forwarded indicator is weaker and less
 *    consistent than WhatsApp's; we look for a "Forwarded" aria-label but expect
 *    it to be usually absent, so the gate leans on structural signals here.
 * ================================================================== */
const MSGR = {
  // role=textbox is the stable anchor; aria-label guards against stray boxes.
  composeBox: 'div[contenteditable="true"][role="textbox"]',
  composeAriaHint: 'message', // lower-cased substring match on aria-label
  sendButton: 'div[aria-label="Send"], button[aria-label="Send"], [aria-label="Press enter to send"]',
  forwardedMarker: '[aria-label*="Forwarded" i]',
};

/** Find the Messenger compose box, preferring one whose aria-label looks like
 *  a message box (guards against search / other textboxes). */
function msgrComposeEl(): HTMLElement | null {
  const boxes = Array.from(document.querySelectorAll(MSGR.composeBox)) as HTMLElement[];
  if (boxes.length === 0) return null;
  // Prefer a box whose aria-label mentions "message".
  const labelled = boxes.find((b) =>
    (b.getAttribute('aria-label') ?? '').toLowerCase().includes(MSGR.composeAriaHint),
  );
  return labelled ?? boxes[0];
}

export const messenger: PlatformAdapter = {
  id: 'messenger',
  matches: (host) => host.endsWith('messenger.com'),
  isSendTarget: (target) => !!target.closest(MSGR.sendButton),
  isInComposeBox: (target) => {
    const box = target.closest(MSGR.composeBox);
    if (!box) return false;
    const label = (box.getAttribute('aria-label') ?? '').toLowerCase();
    // Accept if it looks like the message box, or if it's the only textbox.
    if (label.includes(MSGR.composeAriaHint)) return true;
    return document.querySelectorAll(MSGR.composeBox).length === 1;
  },
  readComposeText: () => {
    const el = msgrComposeEl();
    return el ? el.innerText.trim() : '';
  },
  forwardedSignal: () => {
    try {
      return !!document.querySelector(MSGR.forwardedMarker);
    } catch {
      return false;
    }
  },
  isSendKey: plainEnter,
};

/* ================================================================== *
 * X (Twitter) — ADDED, PENDING LIVE VERIFICATION.
 *
 * SCOPE: (1) the composer (new Tweets and Quote-posts, user types text — RAG
 * works on their own text); (2) Direct Messages (interpersonal, message-based,
 * Messenger-shaped — RAG works on the user's own DM text); and (3) the
 * "share a post via Direct Message" action, which is caught as a CONTENT-BLIND
 * prompt trigger only (no RAG — the shared content is the original poster's).
 * A bare Repost remains out of scope.
 *
 * SELECTOR NOTES (verify each on live x.com / twitter.com):
 *  - Tweet compose box: data-testid="tweetTextarea_0" (contenteditable).
 *  - Post button: data-testid="tweetButton" / "tweetButtonInline".
 *  - DM compose box: data-testid="dmComposerTextInput" (VERIFY casing/hyphens
 *    on live site; the send button below was confirmed hyphenated).
 *  - DM / share send button: data-testid="dm-composer-send-button" (CONFIRMED on
 *    live x.com, Jan 2026). This same button sends both a normal DM and a
 *    "share a post via DM"; catching it covers both interpersonal-send moments.
 *  - Share-to-DM: the final Send in the Share dialog is the dm-composer-send-button
 *    above, so we catch that rather than the flaky "Send via Direct Message" menu
 *    item (which has no testid or aria-label — only visible text).
 *  - Send key: tweet composer sends on Ctrl/Cmd+Enter (Enter = newline); DMs
 *    send on plain Enter. isSendKey below picks based on where the cursor is.
 * ================================================================== */
const X = {
  tweetBox: '[data-testid^="tweetTextarea_"]',
  postButton: '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]',
  // DM text input: try both the confirmed-hyphen style and the older camelCase
  // as a fallback, since only the send button's testid is confirmed so far.
  dmBox: '[data-testid="dm-composer-text-input"], [data-testid="dmComposerTextInput"]',
  // CONFIRMED live: the final Send button for both DMs and share-to-DM.
  dmSend: '[data-testid="dm-composer-send-button"]',
};

/** Is the user currently focused in the DM composer (vs the tweet composer)? */
function xInDm(target: Element): boolean {
  return !!target.closest(X.dmBox);
}

export const x: PlatformAdapter = {
  id: 'x',
  matches: (host) => host.endsWith('x.com') || host.endsWith('twitter.com'),
  isSendTarget: (target) =>
    !!target.closest(X.postButton) || !!target.closest(X.dmSend),
  isInComposeBox: (target) =>
    !!target.closest(X.tweetBox) || !!target.closest(X.dmBox),
  readComposeText: () => {
    // Prefer the DM box if present/focused, else the tweet composer. Only the
    // user's OWN text is ever read here (never a shared post).
    const dm = document.querySelector(X.dmBox) as HTMLElement | null;
    if (dm && dm.innerText.trim()) return dm.innerText.trim();
    const tw = document.querySelector(X.tweetBox) as HTMLElement | null;
    return tw ? tw.innerText.trim() : '';
  },
  forwardedSignal: () => false,
  // Tweet composer: Ctrl/Cmd+Enter. DM: plain Enter. Decide by focus location.
  isSendKey: (e) => {
    const t = e.target;
    if (t instanceof Element && xInDm(t)) return plainEnter(e);
    return modEnter(e);
  },
  // Note: sharing a post into a DM ends with the SAME dm-composer-send-button as
  // a normal DM, so it is caught by isSendTarget above. The compose box read for
  // RAG is the user's own "Write a message..." note, never the shared post — so
  // no separate content-blind share hook is needed on X.
};

/* ================================================================== *
 * Facebook — ADDED, PENDING LIVE VERIFICATION. SHARE-TO-MESSENGER ONLY.
 *
 * SCOPE: this adapter covers only the "Send in Messenger" share action on a
 * feed post — sharing someone else's post into a private message. It is caught
 * CONTENT-BLIND (prompt fires, shared post never read, no RAG). Public feed
 * posting (broadcast) is intentionally NOT covered: it is not the interpersonal
 * forwarding the project targets, and Facebook's composer is the most fragile
 * of all these DOMs. (Facebook Messenger itself is a separate app on
 * messenger.com, already handled by the `messenger` adapter.)
 *
 * SELECTOR NOTES (verify on live facebook.com):
 *  - Share-to-Messenger: CONFIRMED on live facebook.com (Jan 2026) that each
 *    recipient button in the share sheet has aria-label "Send to {name} via
 *    Messenger" and sends on a single click (no separate final Send). Facebook
 *    exposes NO data-testids here, so we must match the aria-label. LIMITATION:
 *    "via Messenger" is English UI text — this selector is language-dependent and
 *    will not fire if the interface is in another language. It is the only stable
 *    hook Facebook offers here; flagged as a known fragility of the FB adapter.
 * ================================================================== */
const FB = {
  // Each recipient row: aria-label="Send to {name} via Messenger". One click sends.
  shareToMessenger: '[aria-label*="via Messenger" i]',
};

export const facebook: PlatformAdapter = {
  id: 'facebook',
  matches: (host) => host.endsWith('facebook.com'),
  // No composer interception in scope: the send-target and compose-box hooks are
  // inert. Only the share-to-Messenger action fires a (content-blind) prompt.
  isSendTarget: () => false,
  isInComposeBox: () => false,
  readComposeText: () => '',
  forwardedSignal: () => false,
  isSendKey: () => false,
  isShareAction: (target) => !!target.closest(FB.shareToMessenger),
};

/** All registered adapters, tried in order. */
export const ADAPTERS: PlatformAdapter[] = [whatsapp, messenger, x, facebook];

/** Pick the adapter for the current page, or null if none matches. */
export function adapterForHost(host: string): PlatformAdapter | null {
  return ADAPTERS.find((a) => a.matches(host)) ?? null;
}
