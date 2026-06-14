/**
 * Content script entry point.
 *
 * Wires together:
 *   - the share-intent interceptor (Send click + Enter),
 *   - the formulation selector (bandit; uniform during walk-throughs),
 *   - telemetry (records each interaction to chrome.storage.local),
 *   - manual preview triggers for demonstration.
 *
 * No message content is ever read, stored, or transmitted.
 */

import { showPrompt, dismiss, type PromptOutcome } from './overlay';
import { type Lang } from './content-data';
import { installInterceptor } from './interceptor';
import { FormulationSelector, type SelectorPolicy } from './selector';
import { appendEvent, makeId, SESSION_KEY, type InteractionEvent } from './telemetry';

const TAG = '%c[AccuPrompt]';
const TAG_STYLE = 'color:#14764f;font-weight:600';

console.log(TAG, TAG_STYLE, 'content script loaded on', location.host);

// --- Session configuration. ---
// During controlled walk-through sessions the policy is "uniform" so every
// formulation gets equal exposure. Outside the study it can be "adaptive".
const POLICY: SelectorPolicy = 'uniform';
let lang: Lang = 'en';
const sessionId = 'S-' + makeId().slice(0, 6);

const selector = new FormulationSelector(POLICY);

// Persist the session id so the dashboard can group events.
try { chrome.storage.local.set({ [SESSION_KEY]: sessionId }); } catch { /* ignore */ }

console.log(TAG, TAG_STYLE, `session ${sessionId}, policy=${POLICY}`);

function toggleLang(): void {
  lang = lang === 'en' ? 'rw' : 'en';
  console.log(TAG, TAG_STYLE, 'language ->', lang);
}

async function record(
  variant: Parameters<typeof selector.record>[0],
  outcome: PromptOutcome,
  trigger: InteractionEvent['trigger'],
): Promise<void> {
  await selector.record(variant, outcome);
  await appendEvent({
    id: makeId(),
    sessionId,
    platform: 'whatsapp',
    formulation: variant,
    language: lang,
    outcome,
    trigger,
    timestamp: new Date().toISOString(),
  });
}

// --- The real interceptor, now driven by the selector. ---
const uninstall = installInterceptor({
  getLang: () => lang,
  // The interceptor asks the selector synchronously, so we pre-pick the next
  // formulation and hand it over via a small async bridge.
  pickVariant: () => selector.next(),
  onResolved: (variant, outcome, trigger) => {
    void record(variant, outcome, trigger);
  },
});

// --- Manual preview triggers (development / demo aid). ---
//   Ctrl+Shift+P  -> show the next formulation (no send)
//   Ctrl+Shift+L  -> toggle language EN <-> RW
async function preview(): Promise<void> {
  const variant = await selector.next();
  console.log(TAG, TAG_STYLE, `preview: ${variant} (${lang})`);
  showPrompt({
    lang,
    variant,
    onOutcome: (outcome: PromptOutcome) => {
      console.log(TAG, TAG_STYLE, 'preview outcome:', outcome);
      void record(variant, outcome, 'preview');
    },
  });
}

window.addEventListener(
  'keydown',
  (e: KeyboardEvent) => {
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyP') {
      e.preventDefault();
      void preview();
    } else if (e.ctrlKey && e.shiftKey && e.code === 'KeyL') {
      e.preventDefault();
      toggleLang();
    }
  },
  true,
);

window.addEventListener('beforeunload', () => {
  dismiss();
  uninstall();
});

console.log(
  TAG,
  TAG_STYLE,
  'ready. Interceptor active. Ctrl+Shift+P = preview, Ctrl+Shift+L = toggle EN/RW',
);
