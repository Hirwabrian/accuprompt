/**
 * Content script entry point.
 *
 * Wires together:
 *   - the share-intent interceptor (Send click + Enter),
 *   - the formulation selector (bandit; uniform during walk-throughs),
 *   - telemetry (records each interaction to chrome.storage.local),
 *   - manual preview triggers for demonstration.
 *
 * Message content: read ONLY when RAG is enabled, and ONLY locally, to retrieve
 * related fact-checks. With RAG disabled the script never reads message text.
 */

import { showPrompt, dismiss, refreshLanguage, isPromptOpen, type PromptOutcome } from './overlay';
import { type Lang } from './content-data';
import { installInterceptor, activePlatform } from './interceptor';
import { FormulationSelector, type SelectorPolicy } from './selector';
import { appendEvent, makeId, SESSION_KEY, RAG_FLAG_KEY, LANG_KEY, GATE_FLAG_KEY, type InteractionEvent } from './telemetry';

const TAG = '%c[AccuPrompt]';
const TAG_STYLE = 'color:#14764f;font-weight:600';

console.log(TAG, TAG_STYLE, 'content script loaded on', location.host);

// --- Session configuration. ---
// During controlled walk-through sessions the policy is "uniform" so every
// formulation gets equal exposure. Outside the study it can be "adaptive".
const POLICY: SelectorPolicy = 'uniform';

// RAG default for this build. The A/B walk-throughs flip this; the popup can
// also override it at runtime (read below). false = content-blind, no retrieval.
const RAG_ENABLED_DEFAULT = true;
let ragEnabled = RAG_ENABLED_DEFAULT;

// Triggering gate default. When true, the interceptor only prompts on
// claim-like messages (structural signals); when false it prompts on every send
// (content-blind). Runtime-overridable from storage, like RAG.
const GATE_ENABLED_DEFAULT = true;
let gateEnabled = GATE_ENABLED_DEFAULT;

let lang: Lang = 'en';
const sessionId = 'S-' + makeId().slice(0, 6);
// The platform this content script is running on (whatsapp | messenger),
// resolved from the adapter that matched the current host. Falls back to
// 'whatsapp' defensively so telemetry always has a valid value.
const PLATFORM = activePlatform() ?? 'whatsapp';

const selector = new FormulationSelector(POLICY);

// Persist the session id so the dashboard can group events.
try { chrome.storage.local.set({ [SESSION_KEY]: sessionId }); } catch { /* ignore */ }

console.log(TAG, TAG_STYLE, `session ${sessionId}, policy=${POLICY}`);

function toggleLang(): void {
  setLang(lang === 'en' ? 'rw' : 'en');
}

/**
 * Apply a language to the running content script: update state, persist, show
 * the confirmation toast, and re-render any open prompt. Shared by the keyboard
 * toggle and the popup message so both behave identically. No-ops if the target
 * equals the current language (avoids a redundant toast when the popup echoes
 * the value already in effect).
 */
function setLang(target: Lang): void {
  if (target === lang) return;
  lang = target;
  console.log(TAG, TAG_STYLE, 'language ->', lang);
  try { chrome.storage.local.set({ [LANG_KEY]: lang }); } catch { /* ignore */ }
  showLangToast(lang);
  if (isPromptOpen()) refreshLanguage(lang);
}

// Listen for a language change pushed from the popup (mini-dashboard). The popup
// can only change storage on its own; this message is what makes a live tab
// update immediately, mirroring the keyboard toggle.
try {
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || typeof msg.type !== 'string') return;
    if (msg.type === 'accuprompt:set-lang' &&
        (msg.lang === 'en' || msg.lang === 'rw')) {
      setLang(msg.lang as Lang);
    } else if (msg.type === 'accuprompt:set-rag' && typeof msg.on === 'boolean') {
      ragEnabled = msg.on;
      console.log(TAG, TAG_STYLE, 'RAG enabled =', ragEnabled);
    } else if (msg.type === 'accuprompt:set-gate' && typeof msg.on === 'boolean') {
      gateEnabled = msg.on;
      console.log(TAG, TAG_STYLE, 'gate enabled =', gateEnabled);
    }
  });
} catch { /* ignore */ }

// Brief on-screen confirmation so the language switch is never ambiguous
// (the keypress can otherwise flip a variable silently with no visible cue).
function showLangToast(current: Lang): void {
  const existing = document.getElementById('accuprompt-lang-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'accuprompt-lang-toast';
  toast.textContent =
    current === 'rw' ? 'Ururimi: Ikinyarwanda' : 'Language: English';
  toast.style.cssText = [
    'position:fixed', 'bottom:24px', 'left:50%', 'transform:translateX(-50%)',
    'background:#14764f', 'color:#fff', 'font:600 14px Inter,system-ui,sans-serif',
    'padding:10px 18px', 'border-radius:999px', 'z-index:2147483647',
    'box-shadow:0 4px 14px rgba(0,0,0,.25)', 'pointer-events:none',
  ].join(';');
  document.documentElement.appendChild(toast);
  setTimeout(() => toast.remove(), 1600);
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
    platform: PLATFORM,
    formulation: variant,
    language: lang,
    outcome,
    trigger,
    timestamp: new Date().toISOString(),
  });
}

// Read the RAG runtime override (set by the popup), falling back to the build default.
try {
  chrome.storage.local.get([RAG_FLAG_KEY, LANG_KEY, GATE_FLAG_KEY]).then((got) => {
    const v = got[RAG_FLAG_KEY];
    if (typeof v === 'boolean') {
      ragEnabled = v;
      console.log(TAG, TAG_STYLE, 'RAG enabled =', ragEnabled);
    }
    const g = got[GATE_FLAG_KEY];
    if (typeof g === 'boolean') {
      gateEnabled = g;
      console.log(TAG, TAG_STYLE, 'gate enabled =', gateEnabled);
    }
    const savedLang = got[LANG_KEY];
    if (savedLang === 'en' || savedLang === 'rw') {
      lang = savedLang;
      console.log(TAG, TAG_STYLE, 'language restored ->', lang);
    }
  });
} catch { /* ignore */ }

// Record that the user opened the evidence panel (RAG behavioural signal).
async function recordExpand(
  variant: Parameters<typeof selector.record>[0],
): Promise<void> {
  await appendEvent({
    id: makeId(),
    sessionId,
    platform: PLATFORM,
    formulation: variant,
    language: lang,
    outcome: 'evidence_expand',
    trigger: 'rag',
    timestamp: new Date().toISOString(),
  });
}

// Record that the gate suppressed a prompt (so the A/B can measure how often
// the gate fired and why). Uses the next variant only as a placeholder slot.
async function recordGateSkip(reason: string): Promise<void> {
  await appendEvent({
    id: makeId(),
    sessionId,
    platform: PLATFORM,
    formulation: 'evaluation', // no formulation was shown; slot is nominal
    language: lang,
    outcome: 'gate_skip',
    trigger: 'gate',
    timestamp: new Date().toISOString(),
    note: reason,
  });
}

// --- The real interceptor, now driven by the selector. ---
const uninstall = installInterceptor({
  getLang: () => lang,
  // The interceptor asks the selector synchronously, so we pre-pick the next
  // formulation and hand it over via a small async bridge.
  pickVariant: () => selector.next(),
  ragEnabled: () => ragEnabled,
  onEvidenceExpand: (variant) => { void recordExpand(variant); },
  gateEnabled: () => gateEnabled,
  onGateSkip: (reason) => { void recordGateSkip(reason); },
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
    } else if (e.ctrlKey && e.shiftKey && (e.code === 'KeyL' || e.code === 'KeyK')) {
      // L is the documented key; K is a fallback in case the browser
      // intercepts Ctrl+Shift+L on some platforms.
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
