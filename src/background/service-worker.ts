/**
 * Background service worker.
 *
 * Owns the telemetry write. The content script sends each InteractionEvent here
 * via chrome.runtime.sendMessage; the worker appends it to chrome.storage.local.
 * Centralising the write in the worker (a) gives a single context with
 * unambiguous storage access, and (b) means the dashboard's storage.onChanged
 * listener reliably observes worker-originated writes, so the dashboard updates
 * live. This is the BackgroundService role from the architecture (Chapter
 * Three) and the single place a future backend sync would hook in. No network
 * calls are made; storage is local to this browser.
 */

import { EVENTS_KEY, type InteractionEvent } from '../content/telemetry';

const TAG = '[AccuPrompt:bg]';

chrome.runtime.onInstalled.addListener(() => {
  console.log(TAG, 'installed. Telemetry stored locally; no backend sync.');
});

async function appendEvent(ev: InteractionEvent): Promise<void> {
  const got = await chrome.storage.local.get(EVENTS_KEY);
  const list = (got[EVENTS_KEY] as InteractionEvent[] | undefined) ?? [];
  list.push(ev);
  await chrome.storage.local.set({ [EVENTS_KEY]: list });
  console.log(TAG, 'recorded event', ev.formulation, ev.outcome);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'accuprompt:event' && msg.event) {
    // Perform the async write, then respond. Return true to keep the channel open.
    appendEvent(msg.event as InteractionEvent)
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg?.type === 'accuprompt:ping') {
    sendResponse({ ok: true });
    return false;
  }
  return false;
});
