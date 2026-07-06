/**
 * RAG evidence module (Step 4).
 *
 * Two responsibilities:
 *   1. Talk to the local retrieval backend (Step 3's FastAPI service).
 *   2. Build the expandable "See related fact-checks" panel that the overlay
 *      reveals on demand.
 *
 * Design decisions (see build discussion):
 *   - Retrieval fires in the BACKGROUND when the prompt opens; the panel is
 *     hidden behind a toggle and revealed instantly on click (data already there).
 *   - The toggle only appears if RAG is enabled AND matches were found above the
 *     backend's similarity threshold. No matches -> no toggle (honest: the
 *     system only speaks when it has something).
 *   - Each match shows CLAIM + LABEL together (a label alone is meaningless,
 *     since the corpus contains claims phrased both ways).
 *   - When display_quality is "weak", the Q&A evidence is foregrounded over the
 *     annotator-style justification; when "ok", the justification leads.
 *   - Graceful degradation: backend down/slow -> no toggle, prompt still works.
 *
 * No message content is stored or transmitted anywhere except the local
 * retrieval call the user's own backend serves.
 */

// One place to change the backend location.
export const RAG_BACKEND_URL = 'http://127.0.0.1:8000';

export interface RagEvidence {
  q: string;
  a: string;
}
export interface RagMatch {
  claim: string;
  label: string;
  justification: string;
  evidence: RagEvidence[];
  source: string;
  location: string;
  display_quality: 'ok' | 'weak';
  similarity: number;
  rw_justification?: string;
  rw_label?: string;
  rw_reviewed?: boolean;
}
export interface RagResult {
  matches: RagMatch[];
  note: string;
}

/**
 * Call the retrieval backend for a claim. Returns matches, or an empty result
 * on any failure (so the caller degrades gracefully). Never throws.
 */
export async function retrieve(claim: string, timeoutMs = 4000): Promise<RagResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${RAG_BACKEND_URL}/retrieve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claim }),
      signal: controller.signal,
    });
    if (!res.ok) return { matches: [], note: 'backend error' };
    const data = await res.json();
    return { matches: data.matches ?? [], note: data.note ?? '' };
  } catch {
    return { matches: [], note: 'backend unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

const LABEL_TONE: Record<string, string> = {
  Refuted: 'refuted',
  Supported: 'supported',
  'Not Enough Evidence': 'unclear',
  'Conflicting Evidence/Cherrypicking': 'unclear',
  'Conflicting Evidence/Cherry-picking': 'unclear',
};

/** CSS for the panel — injected alongside the overlay's own style. */
export const RAG_STYLE = `
  .rag-toggle {
    margin-top: 14px;
    width: 100%;
    background: #f2f5f7;
    border: 1px solid #c9d4db;
    border-radius: 9px;
    padding: 10px 14px;
    font: inherit;
    font-size: 14px;
    color: #2b3a44;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .rag-toggle:hover { background: #e9eef1; }
  .rag-toggle .chev { transition: transform 120ms ease; color: #6a7b85; }
  .rag-toggle.open .chev { transform: rotate(180deg); }

  .rag-panel {
    margin-top: 10px;
    display: none;
    /* Keep the panel from dominating the prompt: cap its height and scroll
       internally so 3 matches never push the whole overlay off-screen. */
    max-height: 320px;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-right: 2px;
  }
  .rag-panel.open { display: block; }
  /* Slim scrollbar so the internal scroll doesn't look heavy. */
  .rag-panel::-webkit-scrollbar { width: 8px; }
  .rag-panel::-webkit-scrollbar-thumb {
    background: #d3dde3; border-radius: 4px;
  }
  .rag-panel::-webkit-scrollbar-track { background: transparent; }

  .rag-match {
    border: 1px solid #e4ebef;
    border-radius: 9px;
    padding: 10px 12px;
    margin-bottom: 8px;
    background: #fbfcfd;
  }
  .rag-match:last-child { margin-bottom: 0; }
  .rag-claim {
    font-size: 13px; font-weight: 600; color: #16242e; line-height: 1.35;
    /* Long corpus claims are clamped to 2 lines so the card header stays tidy. */
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .rag-label {
    display: inline-block;
    font-size: 10.5px;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 5px;
    margin-top: 6px;
  }
  .rag-label.refuted { background: #fff0ed; color: #b5482f; }
  .rag-label.supported { background: #e9f6ef; color: #0f5e3f; }
  .rag-label.unclear { background: #eef2f4; color: #45555f; }
  .rag-label-draft { font-weight: 400; font-style: italic; opacity: 0.85; }
  .rag-text {
    font-size: 12.5px; color: #3a4b56; line-height: 1.45; margin-top: 7px;
    /* Clamp the justification to a few lines; the full text is one tap away via
       the source link, so the panel stays compact by default. */
    display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical;
    overflow: hidden;
    cursor: pointer;
  }
  .rag-text.expanded {
    -webkit-line-clamp: unset; display: block; overflow: visible;
  }
  .rag-ev { font-size: 12px; color: #45555f; line-height: 1.4; margin-top: 6px; }
  .rag-ev b { color: #2b3a44; font-weight: 600; }
  .rag-src { font-size: 11.5px; margin-top: 7px; }
  .rag-src a { color: #14764f; text-decoration: none; }
  .rag-src a:hover { text-decoration: underline; }
  .rag-disclaimer {
    font-size: 11px; color: #8294a0; line-height: 1.4; margin-top: 4px;
  }
  .rag-provenance {
    font-size: 11px; color: #9a6a1c; background: #fff7e8;
    border: 1px solid #f0dcb0; border-radius: 6px;
    padding: 4px 7px; margin-top: 7px; line-height: 1.35;
  }
`;

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

/** Render one match into a DOM node (textContent only — no injection). */
function renderMatch(m: RagMatch, lang: 'en' | 'rw'): HTMLElement {
  const wrap = el('div', 'rag-match');

  wrap.appendChild(el('div', 'rag-claim', m.claim));

  // Label: show the Kinyarwanda label when present (and not a leftover TODO_
  // placeholder); else show English. The tone class is ALWAYS keyed off the
  // English label, so the colour (red/green/neutral) reflects the true verdict
  // even if the Kinyarwanda word itself is an unreviewed draft.
  const tone = LABEL_TONE[m.label] ?? 'unclear';
  const useRwLabel =
    lang === 'rw' && !!m.rw_label && !m.rw_label.startsWith('TODO_');
  const labelText = useRwLabel ? (m.rw_label as string) : m.label;
  const labelSpan = el('span', `rag-label ${tone}`, labelText);
  // If we're showing a Kinyarwanda label that hasn't been reviewed, mark it
  // visibly as provisional — a verdict word is polarity-critical, so an
  // unreviewed one must never read as confirmed.
  if (useRwLabel && m.rw_reviewed === false) {
    labelSpan.appendChild(el('span', 'rag-label-draft', ' (agateganyo)'));
  }
  wrap.appendChild(labelSpan);

  // Show Kinyarwanda justification only if present; else fall back to English.
  const hasRw = lang === 'rw' && !!(m.rw_justification && m.rw_justification.trim());

  // Foreground evidence when the justification is weak; otherwise lead with it.
  if (m.display_quality === 'weak') {
    for (const ev of m.evidence.slice(0, 2)) {
      const e = el('div', 'rag-ev');
      const b = el('b', undefined, 'Q: ');
      e.appendChild(b);
      e.appendChild(document.createTextNode(ev.q));
      e.appendChild(document.createElement('br'));
      const ab = el('b', undefined, 'A: ');
      e.appendChild(ab);
      e.appendChild(document.createTextNode(ev.a));
      wrap.appendChild(e);
    }
  } else {
    const text = hasRw ? (m.rw_justification as string) : m.justification;
    if (text) {
      const t = el('div', 'rag-text', text);
      // The text is clamped to 4 lines by CSS. If it's long enough to be
      // clamped, allow a click to expand it inline (so the panel stays compact
      // by default but the full justification is one tap away, no navigation).
      t.addEventListener('click', () => {
        t.classList.toggle('expanded');
      });
      t.title = 'Click to expand';
      wrap.appendChild(t);
    }
  }

  // Provenance / fallback notes (Kinyarwanda mode only).
  if (lang === 'rw') {
    if (hasRw && m.rw_reviewed === false) {
      wrap.appendChild(el('div', 'rag-provenance',
        '\u26a0 Byahinduwe na mudasobwa \u2014 ntibirasuzumwa. (Auto-translated, not yet reviewed.)'));
    } else if (!hasRw) {
      wrap.appendChild(el('div', 'rag-provenance',
        'Igisubizo cyerekanwe mu Cyongereza. (Shown in English \u2014 no reviewed translation yet.)'));
    }
  }

  if (m.source) {
    const src = el('div', 'rag-src');
    const a = document.createElement('a');
    a.href = m.source;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = 'View full fact-check ↗';
    src.appendChild(a);
    wrap.appendChild(src);
  }
  return wrap;
}

export interface PanelHandle {
  /** The toggle button + panel, to append into the card. */
  node: HTMLElement;
  /** Call when retrieval resolves, to fill the panel. Returns whether a toggle is shown. */
  fill: (result: RagResult) => boolean;
}

/**
 * Build the toggle + (hidden) panel. Initially shows a "looking…" state until
 * fill() is called. onExpand fires the first time the user opens it (for telemetry).
 */
export function buildPanel(onExpand: () => void, lang: 'en' | 'rw' = 'en'): PanelHandle {
  const container = el('div', 'rag-container');

  const toggle = el('button', 'rag-toggle') as HTMLButtonElement;
  toggle.style.display = 'none'; // hidden until we know there are matches
  const TOGGLE_LABEL = lang === 'rw' ? 'Reba ibijyanye n\u2019iki kibazo' : 'See related fact-checks';
  toggle.appendChild(el('span', 'rag-toggle-label', TOGGLE_LABEL));
  toggle.appendChild(el('span', 'chev', '▾'));

  const panel = el('div', 'rag-panel');

  let expandedOnce = false;
  toggle.addEventListener('click', () => {
    const open = panel.classList.toggle('open');
    toggle.classList.toggle('open', open);
    if (open && !expandedOnce) {
      expandedOnce = true;
      onExpand();
    }
  });

  container.appendChild(toggle);
  container.appendChild(panel);

  const fill = (result: RagResult): boolean => {
    if (!result.matches.length) {
      toggle.style.display = 'none';
      return false;
    }
    const count = result.matches.length;
    (toggle.querySelector('.rag-toggle-label') as HTMLElement).textContent =
      `${TOGGLE_LABEL} (${count})`;
    for (const m of result.matches) panel.appendChild(renderMatch(m, lang));
    const disc = el('div', 'rag-disclaimer',
      lang === 'rw'
        ? 'Byavuye mu bubiko bw\u2019ibisuzumwa. Ibyiciro bireba buri kibazo cyabonetse, gishobora kuba cyanditse mu buryo butandukanye n\u2019ubutumwa bwawe.'
        : 'Retrieved from a fact-check database for reflection. Labels apply to each retrieved claim, which may be worded differently from your message.');
    panel.appendChild(disc);
    toggle.style.display = 'flex';
    return true;
  };

  return { node: container, fill };
}
