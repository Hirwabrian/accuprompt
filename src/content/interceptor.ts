/**
 * Share-intent interceptor (step 4).
 *
 * Catches the moment of sharing on WhatsApp Web — both the Send button click
 * and the Enter keypress — in the capture phase, before WhatsApp's own handler
 * runs. It then shows the accuracy prompt. The user's message is never read,
 * copied, modified, or re-injected: we only intercept the *event*. The text
 * stays in WhatsApp's compose box under WhatsApp's control the whole time.
 *
 * Behaviour (prototype / Stage I): "close and let them resend".
 *   - First send attempt for a message -> blocked, prompt shown.
 *   - User chooses "proceed" -> we set a one-shot pass-through flag; the prompt
 *     closes and the user simply clicks Send (or presses Enter) again, which
 *     now passes through untouched.
 *   - User chooses "edit" or "cancel" -> prompt closes, message left in the box.
 *
 * Auto-replay (programmatically re-triggering the send) is deliberately NOT
 * done here; it is a later polish step.
 */

import { showPrompt, type PromptOutcome } from './overlay';
import { type Lang, type FormulationType } from './content-data';

/* ------------------------------------------------------------------ *
 * WhatsApp-specific selectors — THE ONE PLACE TO EDIT IF WA CHANGES.
 *
 * Observed on web.whatsapp.com (June 2026). The obfuscated class names
 * (x14z9mp, etc.) are intentionally NOT used — only semantic attributes,
 * which are far more stable.
 * ------------------------------------------------------------------ */
const WA = {
  /** The Send button. Present only when there is text to send. */
  sendButton: 'button[aria-label="Send"]',
  /** Fallback: the send icon span, in case aria-label is localised/changed. */
  sendIcon: '[data-icon="wds-ic-send-filled"]',
  /** The message compose box (contenteditable). Note: search box is also
   *  contenteditable, so we additionally require it to live in the footer. */
  composeBox: 'div[contenteditable="true"][role="textbox"]',
  /** The conversation footer that contains the real compose box (used to
   *  distinguish the message box from the chat-search box). */
  footer: 'footer',
};

const TAG = '%c[AccuPrompt]';
const TAG_STYLE = 'color:#14764f;font-weight:600';

export interface InterceptorConfig {
  getLang: () => Lang;
  /** Asynchronously choose the formulation to show (driven by the selector). */
  pickVariant: () => Promise<FormulationType>;
  /** Called after the user responds, with the chosen variant, outcome, trigger. */
  onResolved?: (
    variant: FormulationType,
    outcome: PromptOutcome,
    trigger: 'click' | 'enter',
  ) => void;
}

/** One-shot flag: when true, the next send attempt passes through untouched. */
let passThroughNext = false;
/** Guard so we don't stack prompts if events fire in quick succession. */
let promptOpen = false;

/** Is this node the send button (or inside it)? */
function isSendButton(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const btn = target.closest(WA.sendButton);
  if (btn) return true;
  // Fallback: click landed on the icon span/svg inside an unlabelled button.
  const icon = target.closest(WA.sendIcon);
  if (icon && icon.closest('button')) return true;
  return false;
}

/** Is the event happening inside the real message compose box? */
function isInComposeBox(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const box = target.closest(WA.composeBox);
  if (!box) return false;
  // Require it to live inside the conversation footer, so the chat-search
  // box (also contenteditable) does not trigger the prompt.
  return !!box.closest(WA.footer);
}

async function firePrompt(
  trigger: 'click' | 'enter',
  cfg: InterceptorConfig,
): Promise<void> {
  if (promptOpen) return;
  promptOpen = true;

  const variant = await cfg.pickVariant();
  const lang = cfg.getLang();
  console.log(TAG, TAG_STYLE, `intercepted ${trigger} -> prompt ${variant} (${lang})`);

  showPrompt({
    lang,
    variant,
    onOutcome: (outcome: PromptOutcome) => {
      promptOpen = false;
      console.log(TAG, TAG_STYLE, 'outcome:', outcome);
      if (outcome === 'proceed') {
        // Let the user's NEXT send attempt go through untouched.
        passThroughNext = true;
      }
      cfg.onResolved?.(variant, outcome, trigger);
    },
  });
}

export function installInterceptor(cfg: InterceptorConfig): () => void {
  const onClick = (e: MouseEvent): void => {
    if (!isSendButton(e.target)) return;

    if (passThroughNext) {
      // This is the user's deliberate re-send after proceeding. Let it go,
      // and re-arm the interceptor for the next, different message.
      passThroughNext = false;
      console.log(TAG, TAG_STYLE, 'pass-through send (post-proceed)');
      return;
    }

    e.preventDefault();
    e.stopImmediatePropagation();
    void firePrompt('click', cfg);
  };

  const onKeydown = (e: KeyboardEvent): void => {
    // Enter (without Shift) in the compose box = send. Shift+Enter = newline.
    if (e.key !== 'Enter' || e.shiftKey) return;
    if (!isInComposeBox(e.target)) return;

    if (passThroughNext) {
      passThroughNext = false;
      console.log(TAG, TAG_STYLE, 'pass-through send (post-proceed, enter)');
      return;
    }

    e.preventDefault();
    e.stopImmediatePropagation();
    void firePrompt('enter', cfg);
  };

  // Capture phase (true) so we run BEFORE WhatsApp's own bubbling handlers.
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeydown, true);

  console.log(TAG, TAG_STYLE, 'interceptor installed (click + Enter, capture phase)');

  // Return an uninstall function for hot-reload cleanup.
  return () => {
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeydown, true);
  };
}
