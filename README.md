# AccuPrompt — Prototype

A browser-extension prototype that presents a brief, autonomy-preserving
**accuracy prompt** at the moment a user shares content on WhatsApp Web. It is
the software artifact for a BSc Software Engineering capstone (ALU) on reducing
misinformation sharing among Kinyarwanda- and English-speaking users in Rwanda.

> Research prototype (Stage I). Evaluated through cognitive walk-throughs, not a
> deployed trial. Message text is inspected **locally and ephemerally** — to
> decide whether a message is worth prompting on, and to look up related
> fact-checks — but is **never stored, and only a fact-check query is ever sent**
> (to a retrieval backend running on the same machine). Telemetry contains no
> message content.

- **GitHub:** <https://github.com/Hirwabrian/accuprompt.git>
- **Demo video:** <https://drive.google.com/file/d/1ExzcWSrCZJY15DO8oxqLDpvg74CLq7w7/view?usp=sharing>

## What it does

When a user is about to send a message on WhatsApp Web, the extension intercepts
the send action (in the capture phase, before WhatsApp's own handler) and shows
a short prompt inviting them to consider whether the information is accurate. The
user can reconsider, share anyway, or cancel — the decision is always theirs, and
the message stays untouched in the compose box throughout.

Key properties:

- **At the moment of sharing.** Catches both the Send-button click and the Enter key.
- **Triggering gate (structural).** A gate decides whether a send is worth
  prompting on, so the extension doesn't interrupt every trivial message. It reads
  the message's _structure_ — length, presence of a link, presence of numerals,
  and (opportunistically) forwarded status — **not its meaning**. It does not
  match keywords, classify topic, or judge truth. The gate can be turned off, in
  which case the extension is fully content-blind and prompts on every send (one
  of the A/B arms). See `src/content/gate.ts`.
- **Four formulations.** The four accuracy-prompt formulations of Epstein et al.
  (2021): evaluation, importance, tips, normative.
- **Adaptive selection (multi-armed bandit).** Which formulation is shown is
  chosen by a simple bandit (epsilon-greedy). During controlled walk-through
  sessions this is set to **uniform** mode so every formulation gets equal
  exposure; an **adaptive** mode is available outside the study.
- **Retrieval-only evidence panel (RAG).** When enabled, an expandable panel
  shows related human-written fact-checks retrieved from a local corpus. It is
  **retrieval-only** — it displays existing fact-checks and cannot generate text
  or invent a verdict. Can be turned off (the other A/B axis). See "Retrieval
  backend" below.
- **Local telemetry + dashboard.** Each interaction (session, formulation,
  language, outcome, gate-skips, evidence-panel opens, timestamp — never content)
  is recorded to `chrome.storage.local` and viewable in a companion dashboard.
- **English + Kinyarwanda.** Kinyarwanda prompt strings, fact-check translations,
  and verdict labels are **drafts** and show a "not reviewed" warning until a
  native speaker signs off.

## Setup

Requirements: Node 18+ and npm.

```bash
npm install
npm run build        # produces dist/ as a loadable unpacked extension
# or, for development with hot reload:
npm run dev
```

Load it in Chrome or Edge:

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select the `dist/` folder
   (for `npm run dev`, CRXJS prints which folder to load)
4. Open <https://web.whatsapp.com> and log in
5. Open the console (F12) — you should see `[AccuPrompt] content script loaded`

## Using it

On WhatsApp Web, with the page focused:

- **Type a message and click Send (or press Enter)** → the accuracy prompt appears;
  the message stays in the box. Choose _Let me reconsider_, _Share anyway_, or
  _Cancel_. After _Share anyway_, send again and it passes through.
- **Ctrl + Shift + P** — preview the next formulation without sending.
- **Ctrl + Shift + L** (or **Ctrl + Shift + K** if your browser intercepts L) —
  toggle language (English ⇄ Kinyarwanda draft). A toast confirms the switch, and
  an open prompt re-renders immediately in the new language.
- Click the **extension icon** for the popup: language, **study-arm toggles**
  (Evidence on/off = RAG, Smart trigger / Prompt every send = gate), session id,
  and the dashboard link. Arm changes apply to the live tab immediately.
- Open the **companion dashboard** from the popup to see recorded events, with
  per-signal tiles (prompts shown, paused rate, gate skips, evidence opens) and
  Export-JSON / Clear.

## Designs

Interface mockups (Figma + rendered PNGs) are in `designs/`:

- `0_cover.png` — title frame
- `1_overlay.png` — the accuracy prompt over WhatsApp Web
- `2_formulations.png` — the four formulations
- `3_popup.png` — the extension popup
- `4_dashboard.png` — the companion dashboard

There is **no circuit diagram**: this is a software (FullStack) project with no
hardware. The system architecture, class, ER, and sequence diagrams are in the
capstone proposal (Chapter Three).

## Architecture

```
src/
  content/
    index.ts          content-script entry: wires interceptor + selector + gate + telemetry
    interceptor.ts     capture-phase Send/Enter interception (centralised WA selectors)
    gate.ts            structural triggering gate ("is this worth prompting on?")
    gate.test.ts       unit tests for the gate's decision logic
    overlay.ts         the prompt overlay, rendered in a Shadow DOM (style-isolated)
    rag.ts             retrieval evidence panel: calls the local backend, renders matches
    content-data.ts    the four formulations + UI strings (EN final, RW draft)
    selector.ts        multi-armed bandit formulation selector (uniform | adaptive)
    telemetry.ts       interaction-event model + chrome.storage helpers
  background/
    service-worker.ts  minimal message bus / future backend-sync point
  popup/               extension popup (language, study-arm toggles, session, dashboard)
  dashboard/           companion dashboard (reads local telemetry)

rag_build/             offline corpus prep + retrieval backend (Python; see below)
  step1_audit_local.py   audit the AVeriTeC corpus
  step2_embed.py         embed claim+justification with MiniLM -> corpus.npz
  step5_translate.py     draft Kinyarwanda translation (NLLB-600M) -> corpus_rw.npz
  backend.py             FastAPI retrieval service (localhost:8000)
```

## Machine-learning component (formulation selector)

Which formulation is shown is chosen by a **multi-armed bandit** (epsilon-greedy),
implemented in `src/content/selector.ts`:

- **In the extension:** the companion dashboard shows the bandit's live per-arm
  statistics (times shown, reflective-outcome rate, and the favoured arm in
  adaptive mode), so the selector's state is inspectable, not just asserted.
- **Offline simulation:** `simulation/` contains a notebook
  (`bandit_simulation.ipynb`) and script (`simulate.py`) that run the _same_
  policy over many synthetic interactions and plot convergence and regret. This
  demonstrates the algorithm learns, using **assumed illustrative** reflective
  rates (not findings — see that folder's README).
- During walk-through sessions the selector runs in **uniform mode** (equal
  exposure) for a fair comparison; adaptive mode is for outside the study. A
  **contextual** bandit (personalising by user/context) is future work.

## Triggering gate (`gate.ts`)

So the extension doesn't interrupt every message, a gate decides whether a send
is worth prompting on. It is **structural, not semantic** — it reads the shape of
the message, never its meaning:

- **Signals:** length, presence of a link, presence of numerals, and
  (opportunistically) forwarded status.
- **Posture:** conservative — "only prompt when claim-like." Short, link-less,
  figure-less messages pass through silently; messages that are long, carry a
  link, or cite figures trip the gate. Thresholds are in one `GATE_CONFIG` block.
- **The line we hold:** "does this message contain a number?" is structural and
  fair game; "is this number a _false statistic_?" is semantic and out of scope. A
  keyword list or a trained claim-classifier would cross that line and is left as
  future work (and would need a labelled Kinyarwanda corpus, which does not exist
  yet).
- **Forwarded status is opportunistic.** WhatsApp's "Forwarded" marker is the
  ideal signal (forwarding, not authoring, is how misinformation spreads), but at
  the compose-box interception point it is usually **not present** — forwarding
  often bypasses the compose box. Detection returns false gracefully when the
  marker is absent, and the gate runs on the structural signals regardless.
- **Honesty:** when the gate is enabled it reads compose text locally; when
  disabled the extension is fully content-blind and prompts on every send. The
  gate's logic is unit-tested (`gate.test.ts`).

## Retrieval backend (RAG)

When the evidence panel is enabled, the extension queries a small retrieval
service for related human-written fact-checks. This is **retrieval-only**: it
returns existing fact-checks and their human-written justifications; there is no
language model in the loop, so it **cannot generate text or fabricate a verdict**.

- **Corpus:** [AVeriTeC](https://fever.ai/dataset/averitec.html) (English,
  CC BY-NC). ~3,000 real-world claims with human verdicts and justifications.
  **The corpus is not committed to this repo** (licence); see `rag_build/` to
  rebuild it.
- **Pipeline (offline, one-time, Colab):** audit → embed `claim + justification`
  with `all-MiniLM-L6-v2` → `corpus.npz`. Optionally draft-translate a subset of
  justifications into Kinyarwanda with `NLLB-200-distilled-600M` → `corpus_rw.npz`.
- **Backend (laptop):** `backend.py` is a FastAPI service. It loads the corpus
  once, embeds an incoming query with the same MiniLM model, and returns the
  top matches by cosine similarity above a threshold (no vector DB needed at this
  scale). Runs at `http://127.0.0.1:8000`.

  ```bash
  cd rag_build
  pip install fastapi uvicorn sentence-transformers numpy
  uvicorn backend:app --port 8000     # add --reload for development
  # health check: http://127.0.0.1:8000/health  ·  docs: /docs
  ```

  Start the backend **before** opening WhatsApp Web. The extension calls it via
  `host_permissions` for `127.0.0.1:8000`. If the backend is down, retrieval
  fails silently and the core prompt still works (graceful degradation).

- **Threshold behaviour (honest):** with the similarity threshold at 0.5 the
  panel appears only for claims actually present in the corpus. For most messages
  it shows nothing — which is the correct, honest behaviour. Demo and walk-throughs
  should use known-in-corpus claims.
- **Kinyarwanda in the panel:** translated justifications carry an
  "auto-translated, not yet reviewed" banner; verdict labels show a draft word
  with an "(agateganyo)" / provisional marker, and the label **colour is always
  keyed off the English verdict** so polarity is never at the mercy of a draft.

## A/B in the walk-throughs

Two independent on/off axes, both flipped from the popup (no code edits between
participants):

- **Evidence on/off** — the RAG panel.
- **Smart trigger / Prompt every send** — the gate.

The **formulation schedule is held constant** across arms (the selector runs in
uniform mode and is independent of both flags), so RAG-or-gate is the _only_
variable. Vary one axis at a time. The sample size supports **qualitative
impressions of usability, cultural fit, and trust — not measured efficacy.**

## Platforms (Whatsapp,X.com and Facebook/Messenger)

The prototype implements **WhatsApp Web X.com and Facebook/Messenger**. The interceptor and gate are
structured around a small platform seam: a "what counts as a share action here?"
hook and a "where is the text, if any?" hook (see how `gate.ts` takes injected
`readText` and `forwardSignal` functions). A second platform plugs into that seam.

## Deployment plan

This is a Stage I research prototype; "deployment" means distribution to
walk-through facilitators and participants, not a public release.

**Current (walk-through stage).**

- Distributed as an **unpacked extension** loaded via `chrome://extensions` on a
  researcher-provided laptop, or packaged as a `.zip` / `.crx` for sideloading.
- Telemetry stays **local** to the browser (`chrome.storage.local`); the
  researcher exports session events as JSON from the dashboard after each session.
- The **one network call** is to the retrieval backend on `127.0.0.1:8000` — same
  machine, localhost only, and only a fact-check query (not the message) is sent.
  When the evidence panel is disabled, there are no network calls at all. Host
  permissions are limited to WhatsApp Web and localhost.

**Specified but not built (future work).** The proposal's architecture
(Chapter Three) specifies a backend — a FastAPI service with a PostgreSQL store
(schema = the ER diagram) exposing endpoints to serve prompt content and receive
telemetry, behind HTTPS. The `service-worker.ts` is the intended sync point. This
is **out of scope for the prototype** and is documented as the next phase; the
current build is deliberately client-only.

**Eventual distribution (beyond the study).** Chrome Web Store / Edge Add-ons
listing would be the route for a public version, contingent on a reviewed
Kinyarwanda translation and the backend above. A native mobile version is
discussed in the proposal as future work (the interception mechanism is not
feasible inside the closed mobile apps without an accessibility service).

## Status / honesty notes

- **Injection and the overlay** are verified working on live WhatsApp Web.
- **Send/Enter interception** uses semantic selectors (`aria-label="Send"`,
  `data-icon`) centralised in `interceptor.ts`; WhatsApp ships obfuscated,
  changing class names, so if interception stops firing, update the `WA` selector
  block — that's the one place to edit.
- **Kinyarwanda is unreviewed throughout.** Prompt strings, fact-check
  translations (NLLB-600M drafts), and the four verdict labels are all author/MT
  drafts flagged in the UI; none has been confirmed by a native speaker yet.
- **The bandit is in uniform mode during walk-throughs** by design, so the
  qualitative comparison stays clean; it is non-contextual (contextual = future
  work). The offline simulation uses **assumed illustrative** reflective rates and
  validates the _algorithm_, not the formulations.
- **Content inspection is real but local.** With the gate and/or evidence panel
  enabled, the extension reads compose text locally to decide whether to prompt
  and to query the local backend. Nothing is stored; only a fact-check query
  leaves the browser, to localhost. With both disabled, the extension is fully
  content-blind. (Earlier prototype copy described it as unconditionally
  content-blind — that is no longer accurate and has been corrected.)
- **RAG is retrieval-only** over an English, CC BY-NC corpus that is **not in this
  repo**; it cannot generate or alter a verdict. The panel shows nothing for
  out-of-corpus messages by design.
- **The forwarded-status signal may never fire** at the interception point; the
  gate does not depend on it.
- **A/B supports qualitative impressions, not measured efficacy**, at this sample
  size. RAG-vs-no-RAG and gate-vs-no-gate are the only manipulated axes.
