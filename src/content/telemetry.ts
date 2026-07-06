/**
 * Telemetry event model and storage helpers.
 *
 * Event shape mirrors the InteractionEvent entity in the proposal's data model
 * (Chapter Three ERD): session, formulation, language, outcome, timestamp.
 *
 * IMPORTANT: events never contain message content. They record only which
 * formulation was shown, in which language, and which of three coarse outcomes
 * the user chose. Storage is local to the browser (chrome.storage.local); there
 * is no server in this prototype (a backend sync is specified as future work).
 */

import type { Lang, FormulationType } from './content-data';
import type { PromptOutcome } from './overlay';

export interface InteractionEvent {
  id: string;
  sessionId: string;
  platform: 'whatsapp' | 'messenger' | 'facebook' | 'x';
  formulation: FormulationType;
  language: Lang;
  outcome: PromptOutcome | 'evidence_expand' | 'gate_skip';
  trigger: 'click' | 'enter' | 'preview' | 'rag' | 'gate';
  timestamp: string; // ISO 8601
  /** Optional free-text annotation (e.g. the gate's skip reason). */
  note?: string;
}

export const EVENTS_KEY = 'accuprompt.events.v1';
export const SESSION_KEY = 'accuprompt.session.v1';
export const RAG_FLAG_KEY = 'accuprompt.rag.enabled.v1';
export const LANG_KEY = 'accuprompt.lang.v1';
export const GATE_FLAG_KEY = 'accuprompt.gate.enabled.v1';

export function makeId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Append an event. The actual storage write is performed by the service
 *  worker (see background/service-worker.ts), which has unambiguous storage
 *  access and whose writes the dashboard's onChanged listener reliably sees.
 *  Falls back to a direct write if messaging is unavailable. */
export async function appendEvent(ev: InteractionEvent): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ type: 'accuprompt:event', event: ev });
    return;
  } catch {
    /* messaging failed (e.g. worker asleep mid-teardown) — fall back below */
  }
  try {
    const got = await chrome.storage.local.get(EVENTS_KEY);
    const list = (got[EVENTS_KEY] as InteractionEvent[] | undefined) ?? [];
    list.push(ev);
    await chrome.storage.local.set({ [EVENTS_KEY]: list });
  } catch {
    /* best-effort */
  }
}

/** Read all stored events. */
export async function readEvents(): Promise<InteractionEvent[]> {
  try {
    const got = await chrome.storage.local.get(EVENTS_KEY);
    return (got[EVENTS_KEY] as InteractionEvent[] | undefined) ?? [];
  } catch {
    return [];
  }
}
