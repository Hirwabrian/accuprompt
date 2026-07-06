/**
 * Popup logic: shows the current session id and live activity, lets the user
 * pick the prompt language and study arm, and opens the companion dashboard.
 * Preferences are stored so the content script can read them.
 */

import { readEvents, EVENTS_KEY, type InteractionEvent } from '../content/telemetry';

const LANG_KEY = 'accuprompt.lang.v1';
const SESSION_KEY = 'accuprompt.session.v1';
const RAG_FLAG_KEY = 'accuprompt.rag.enabled.v1';
const GATE_FLAG_KEY = 'accuprompt.gate.enabled.v1';

const seg = document.getElementById('lang') as HTMLElement;
const ragSeg = document.getElementById('rag') as HTMLElement;
const gateSeg = document.getElementById('gate') as HTMLElement;
const sidEl = document.getElementById('sid') as HTMLElement;
const shownEl = document.getElementById('stat-shown') as HTMLElement;
const rateEl = document.getElementById('stat-rate') as HTMLElement;
const openDash = document.getElementById('open-dash') as HTMLElement;

// Only real prompt outcomes count toward the counter and the reconsider rate;
// gate_skip and evidence_expand are signals, not shown-prompt decisions.
const PROMPT_OUTCOMES = new Set(['proceed', 'edit', 'cancel']);

// Compute and render live activity for the CURRENT session only.
async function refreshStats(): Promise<void> {
  let sessionId = '';
  try {
    const got = await chrome.storage.local.get(SESSION_KEY);
    sessionId = (got[SESSION_KEY] as string) || '';
  } catch { /* ignore */ }
  if (!sessionId) {
    shownEl.textContent = '0';
    rateEl.textContent = '—';
    return;
  }
  const events = await readEvents();
  const mine = events.filter(
    (e: InteractionEvent) => e.sessionId === sessionId && PROMPT_OUTCOMES.has(e.outcome),
  );
  const shown = mine.length;
  const reconsidered = mine.filter((e) => e.outcome !== 'proceed').length;
  shownEl.textContent = String(shown);
  rateEl.textContent = shown > 0 ? `${Math.round((reconsidered / shown) * 100)}%` : '—';
}

// Restore stored language preference.
chrome.storage.local.get([LANG_KEY, SESSION_KEY, RAG_FLAG_KEY, GATE_FLAG_KEY]).then((got) => {
  const lang = (got[LANG_KEY] as string) || 'en';
  for (const btn of Array.from(seg.querySelectorAll('button'))) {
    btn.classList.toggle('sel', btn.getAttribute('data-lang') === lang);
  }
  // RAG/gate default to ON when no stored value exists (matches build defaults).
  const ragOn = got[RAG_FLAG_KEY] === undefined ? true : got[RAG_FLAG_KEY] === true;
  for (const btn of Array.from(ragSeg.querySelectorAll('button'))) {
    btn.classList.toggle('sel', (btn.getAttribute('data-rag') === 'on') === ragOn);
  }
  const gateOn = got[GATE_FLAG_KEY] === undefined ? true : got[GATE_FLAG_KEY] === true;
  for (const btn of Array.from(gateSeg.querySelectorAll('button'))) {
    btn.classList.toggle('sel', (btn.getAttribute('data-gate') === 'on') === gateOn);
  }
  sidEl.textContent = (got[SESSION_KEY] as string) || 'not started';
});

// Shared: send a runtime message to the active tab's content script (if any).
function notifyTab(msg: Record<string, unknown>): void {
  void chrome.tabs
    .query({ active: true, currentWindow: true })
    .then((tabs) => {
      const tab = tabs[0];
      if (tab?.id != null) {
        chrome.tabs.sendMessage(tab.id, msg).catch(() => {
          // No content script on this tab — stored value applies on next load.
        });
      }
    });
}

seg.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('button');
  if (!btn) return;
  const lang = btn.getAttribute('data-lang')!;
  for (const b of Array.from(seg.querySelectorAll('button'))) {
    b.classList.toggle('sel', b === btn);
  }
  void chrome.storage.local.set({ [LANG_KEY]: lang });
  notifyTab({ type: 'accuprompt:set-lang', lang });
});

ragSeg.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('button');
  if (!btn) return;
  const on = btn.getAttribute('data-rag') === 'on';
  for (const b of Array.from(ragSeg.querySelectorAll('button'))) {
    b.classList.toggle('sel', b === btn);
  }
  void chrome.storage.local.set({ [RAG_FLAG_KEY]: on });
  notifyTab({ type: 'accuprompt:set-rag', on });
});

gateSeg.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('button');
  if (!btn) return;
  const on = btn.getAttribute('data-gate') === 'on';
  for (const b of Array.from(gateSeg.querySelectorAll('button'))) {
    b.classList.toggle('sel', b === btn);
  }
  void chrome.storage.local.set({ [GATE_FLAG_KEY]: on });
  notifyTab({ type: 'accuprompt:set-gate', on });
});

openDash.addEventListener('click', () => {
  const url = chrome.runtime.getURL('src/dashboard/dashboard.html');
  void chrome.tabs.create({ url });
});

// Live activity: render now, and update whenever telemetry changes while the
// popup is open (e.g. a prompt outcome is recorded in the WhatsApp tab).
void refreshStats();
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes[EVENTS_KEY] || changes[SESSION_KEY])) {
    void refreshStats();
  }
});
