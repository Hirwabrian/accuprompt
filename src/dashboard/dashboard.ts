/**
 * Companion dashboard.
 *
 * Reads interaction telemetry from chrome.storage.local and renders summary
 * tiles and an event table. Provides export-to-JSON and clear. There is no
 * backend; everything is local to this browser (a server sync is future work).
 */

import { readEvents, EVENTS_KEY, type InteractionEvent } from '../content/telemetry';
import { SELECTOR_KEY } from '../content/selector';

const tiles = document.getElementById('tiles') as HTMLElement;
const tablewrap = document.getElementById('tablewrap') as HTMLElement;
const banditwrap = document.getElementById('banditwrap') as HTMLElement;
const policyLabel = document.getElementById('policy-label') as HTMLElement;

const FORMULATION_LABEL: Record<string, string> = {
  evaluation: 'Evaluation',
  importance: 'Importance',
  tips: 'Tips',
  normative: 'Normative',
};
const OUTCOME_LABEL: Record<string, { text: string; cls: string }> = {
  proceed: { text: 'Shared anyway', cls: 'proceed' },
  edit: { text: 'Reconsidered', cls: 'edit' },
  cancel: { text: 'Cancelled', cls: 'cancel' },
};

function tile(n: string, label: string, green = false): string {
  return `<div class="tile"><div class="n">${green ? `<span class="g">${n}</span>` : n}</div><div class="l">${label}</div></div>`;
}

function render(events: InteractionEvent[]): void {
  const sessions = new Set(events.map((e) => e.sessionId));
  const reflective = events.filter((e) => e.outcome !== 'proceed').length;
  const total = events.length;
  const pct = total > 0 ? Math.round((reflective / total) * 100) : 0;

  tiles.innerHTML =
    tile(String(sessions.size), 'Sessions') +
    tile(String(total), 'Prompts shown') +
    tile(String(reflective), 'Reconsidered or cancelled', true) +
    tile(total > 0 ? `${pct}%` : '—', 'Paused before sharing');

  if (events.length === 0) {
    tablewrap.innerHTML =
      `<div class="empty">No events recorded yet.<br/>Open WhatsApp Web with the extension active and use <code>Ctrl+Shift+P</code> or send a test message to generate events.</div>`;
    return;
  }

  const rows = [...events]
    .reverse()
    .map((e) => {
      const o = OUTCOME_LABEL[e.outcome] ?? { text: e.outcome, cls: 'cancel' };
      const langLabel = e.language === 'rw' ? 'Kinyarwanda' : 'English';
      const ts = new Date(e.timestamp).toLocaleString();
      return `<tr>
        <td><span class="sid">${e.sessionId}</span></td>
        <td>${FORMULATION_LABEL[e.formulation] ?? e.formulation}</td>
        <td><span class="tag lang">${langLabel}</span></td>
        <td><span class="tag ${o.cls}">${o.text}</span></td>
        <td>${ts}</td>
      </tr>`;
    })
    .join('');

  tablewrap.innerHTML = `<table>
    <thead><tr><th>SESSION</th><th>FORMULATION</th><th>LANGUAGE</th><th>OUTCOME</th><th>TIMESTAMP</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

async function renderBandit(): Promise<void> {
  let state: {
    policy?: string;
    arms?: Record<string, { shown: number; reward: number }>;
  } | undefined;
  try {
    const got = await chrome.storage.local.get(SELECTOR_KEY);
    state = got[SELECTOR_KEY] as typeof state;
  } catch {
    /* ignore */
  }

  policyLabel.textContent = `policy: ${state?.policy ?? 'uniform'}`;

  if (!state || !state.arms) {
    banditwrap.innerHTML =
      `<div class="empty">No selector data yet. Trigger a few prompts to populate the bandit's arm statistics.</div>`;
    return;
  }

  const arms = state.arms;
  const ids = Object.keys(arms);
  // Favoured arm = highest reflective rate among arms shown at least once.
  let favId = '';
  let favRate = -1;
  for (const id of ids) {
    const { shown, reward } = arms[id];
    const rate = shown > 0 ? reward / shown : 0;
    if (shown > 0 && rate > favRate) { favRate = rate; favId = id; }
  }
  const adaptive = state.policy === 'adaptive';

  const rows = ids
    .map((id) => {
      const { shown, reward } = arms[id];
      const rate = shown > 0 ? reward / shown : 0;
      const pct = Math.round(rate * 100);
      const isFav = adaptive && id === favId;
      const star = isFav ? ' <span class="star">\u2605 favoured</span>' : '';
      return `<div class="barrow">
        <div class="name">${FORMULATION_LABEL[id] ?? id}</div>
        <div class="track"><div class="fill ${isFav ? 'fav' : ''}" style="width:${Math.max(pct, 2)}%"></div></div>
        <div class="meta">${reward}/${shown} reflective \u00b7 ${shown > 0 ? pct + '%' : '\u2014'}${star}</div>
      </div>`;
    })
    .join('');

  const hint = adaptive
    ? `In adaptive mode the selector prefers the arm with the highest reflective-outcome rate (\u2605), while still exploring the others.`
    : `Running in uniform mode (used during walk-through sessions): every formulation is shown equally, so these rates reflect even exposure rather than a learned preference.`;

  banditwrap.innerHTML = `<div class="bandit">${rows}<div class="hint">${hint}</div></div>`;
}

async function refresh(): Promise<void> {
  const events = await readEvents();
  render(events);
  await renderBandit();
}

document.getElementById('refresh')!.addEventListener('click', () => void refresh());

document.getElementById('export')!.addEventListener('click', async () => {
  const events = await readEvents();
  const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `accuprompt-events-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('clear')!.addEventListener('click', async () => {
  if (!confirm('Clear all recorded events from this browser? This cannot be undone.')) return;
  try { await chrome.storage.local.set({ [EVENTS_KEY]: [] }); } catch { /* ignore */ }
  void refresh();
});

// Live-update if events change while the dashboard is open.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes[EVENTS_KEY] || changes[SELECTOR_KEY])) void refresh();
});

void refresh();
