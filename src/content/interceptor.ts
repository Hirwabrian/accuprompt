/**
 * Share-intent interceptor.
 *
 * Catches the moment of sharing — both the send-control click and the Enter
 * keypress — in the capture phase, before the platform's own handler runs. It
 * then shows the accuracy prompt. The user's message is never copied, modified,
 * or re-injected: we intercept the *event*, and the text stays in the platform's
 * compose box under the platform's control.
 *
 * This module is PLATFORM-INDEPENDENT. Everything platform-specific (how to
 * recognise a send, where the compose text is, whether a forwarded signal
 * exists) is supplied by a PlatformAdapter (see platforms.ts). Adding a platform
 * means adding an adapter, not editing this engine.
 *
 * Behaviour (prototype / Stage I): "close and let them resend".
 *   - First send attempt -> blocked, prompt shown.
 *   - "proceed" -> one-shot pass-through flag; user sends again, passes through.
 *   - "edit" / "cancel" -> prompt closes, message left in the box.
 */

import { showPrompt, type PromptOutcome } from './overlay';
import { type Lang, type FormulationType } from './content-data';
import { shouldPrompt, type GateDecision } from './gate';
import { adapterForHost, type PlatformAdapter } from './platforms';

const TAG = '%c[AccuPrompt]';
const TAG_STYLE = 'color:#14764f;font-weight:600';

export interface InterceptorConfig {
  getLang: () => Lang;
  pickVariant: () => Promise<FormulationType>;
  onResolved?: (
    variant: FormulationType,
    outcome: PromptOutcome,
    trigger: 'click' | 'enter',
  ) => void;
  /**
   * RAG only. When true, the interceptor reads the compose text and passes it so
   * related fact-checks can be retrieved. When FALSE, message content is never
   * read and the content-blind property is preserved. A function so a runtime
   * toggle takes effect without reinstalling.
   */
  ragEnabled?: () => boolean;
  onEvidenceExpand?: (variant: FormulationType) => void;
  /**
   * Triggering gate. When true, the interceptor reads the compose text's
   * STRUCTURE (length, links, numerals, forwarded status — never meaning) and
   * only prompts if the message looks claim-like. When FALSE, it stays fully
   * content-blind and prompts on every send (the non-gate A/B arm).
   */
  gateEnabled?: () => boolean;
  onGateSkip?: (reason: string) => void;
}

/**
 * Run the triggering gate for the current message, using the active adapter to
 * read text and the forwarded signal. Returns a permissive decision when the
 * gate is disabled (one code path for the caller). Reading text is gated behind
 * cfg.gateEnabled(), so content-blindness holds in the non-gate arm.
 */
function runGate(cfg: InterceptorConfig, adapter: PlatformAdapter): GateDecision {
  if (!cfg.gateEnabled?.()) {
    return {
      prompt: true,
      reason: 'gate disabled',
      signals: { lengthChars: 0, hasLink: false, hasNumerals: false, forwarded: false },
    };
  }
  return shouldPrompt(adapter.readComposeText, adapter.forwardedSignal);
}

/** One-shot flag: when true, the next send attempt passes through untouched. */
let passThroughNext = false;
/** Guard so we don't stack prompts. */
let promptOpen = false;

async function firePrompt(
  trigger: 'click' | 'enter',
  cfg: InterceptorConfig,
  adapter: PlatformAdapter,
  contentBlind = false,
): Promise<void> {
  if (promptOpen) return;
  promptOpen = true;

  const variant = await cfg.pickVariant();
  const lang = cfg.getLang();
  // RAG: read the compose text ONLY if RAG is enabled AND this is not a
  // content-blind trigger (a share-to-DM of someone else's post never reads the
  // shared content, regardless of the RAG toggle).
  const ragClaim =
    !contentBlind && cfg.ragEnabled?.() ? adapter.readComposeText() : undefined;
  console.log(
    TAG, TAG_STYLE,
    `[${adapter.id}] intercepted ${trigger}${contentBlind ? ' (share, content-blind)' : ''} -> prompt ${variant} (${lang})`,
  );

  showPrompt({
    lang,
    variant,
    ragClaim,
    onEvidenceExpand: () => cfg.onEvidenceExpand?.(variant),
    onOutcome: (outcome: PromptOutcome) => {
      promptOpen = false;
      console.log(TAG, TAG_STYLE, 'outcome:', outcome);
      if (outcome === 'proceed') passThroughNext = true;
      cfg.onResolved?.(variant, outcome, trigger);
    },
  });
}

export function installInterceptor(cfg: InterceptorConfig): () => void {
  const adapter = adapterForHost(location.hostname);
  if (!adapter) {
    console.log(TAG, TAG_STYLE, 'no platform adapter for', location.hostname, '- interceptor idle');
    return () => { /* nothing installed */ };
  }

  const onClick = (e: MouseEvent): void => {
    if (!(e.target instanceof Element)) return;

    // Share-a-post-to-DM: the interpersonal-forwarding moment. Fire a
    // content-blind prompt (no RAG, and no gate — there is no user-authored text
    // to assess; the share action itself is the signal).
    if (adapter.isShareAction?.(e.target)) {
      if (passThroughNext) {
        passThroughNext = false;
        console.log(TAG, TAG_STYLE, 'pass-through share (post-proceed)');
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
      void firePrompt('click', cfg, adapter, /* contentBlind */ true);
      return;
    }

    if (!adapter.isSendTarget(e.target)) return;

    if (passThroughNext) {
      passThroughNext = false;
      console.log(TAG, TAG_STYLE, 'pass-through send (post-proceed)');
      return;
    }

    const gate = runGate(cfg, adapter);
    if (!gate.prompt) {
      console.log(TAG, TAG_STYLE, 'gate: no prompt —', gate.reason);
      cfg.onGateSkip?.(gate.reason);
      return;
    }

    e.preventDefault();
    e.stopImmediatePropagation();
    void firePrompt('click', cfg, adapter);
  };

  const onKeydown = (e: KeyboardEvent): void => {
    // What counts as "send" is platform-specific (plain Enter vs Ctrl/Cmd+Enter).
    if (!adapter.isSendKey(e)) return;
    if (!(e.target instanceof Element)) return;
    if (!adapter.isInComposeBox(e.target)) return;

    if (passThroughNext) {
      passThroughNext = false;
      console.log(TAG, TAG_STYLE, 'pass-through send (post-proceed, enter)');
      return;
    }

    const gate = runGate(cfg, adapter);
    if (!gate.prompt) {
      console.log(TAG, TAG_STYLE, 'gate: no prompt —', gate.reason);
      cfg.onGateSkip?.(gate.reason);
      return;
    }

    e.preventDefault();
    e.stopImmediatePropagation();
    void firePrompt('enter', cfg, adapter);
  };

  // Capture phase (true) so we run BEFORE the platform's own bubbling handlers.
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeydown, true);

  console.log(TAG, TAG_STYLE, `interceptor installed for ${adapter.id} (click + Enter, capture phase)`);

  return () => {
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeydown, true);
  };
}

/** Expose the active platform id (for telemetry). */
export function activePlatform(): 'whatsapp' | 'messenger' | 'x' | 'facebook' | null {
  return adapterForHost(location.hostname)?.id ?? null;
}
