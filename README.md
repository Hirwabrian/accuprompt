# AccuPrompt — Prototype
Video link to trial: https://drive.google.com/file/d/1271crwsxytM-KNybATYv5j3d11TO9JJs/view?usp=sharing

A browser-extension prototype that presents a brief, autonomy-preserving
**accuracy prompt** at the moment a user shares content on WhatsApp Web. It is
the software artifact for a BSc Software Engineering capstone (ALU) on reducing
misinformation sharing among Kinyarwanda- and English-speaking users in Rwanda.

> Research prototype (Stage I). Evaluated through cognitive walk-throughs, not a
> deployed trial. No message content is ever read, stored, or transmitted.

- **GitHub:** <ADD YOUR REPO LINK HERE>
- **Demo video:** <ADD YOUR VIDEO LINK HERE>

## What it does

When a user is about to send a message on WhatsApp Web, the extension intercepts
the send action (in the capture phase, before WhatsApp's own handler) and shows
a short prompt inviting them to consider whether the information is accurate. The
user can reconsider, share anyway, or cancel — the decision is always theirs, and
the message stays untouched in the compose box throughout.

Key properties:

- **At the moment of sharing.** Catches both the Send-button click and the Enter key.
- **Content-blind.** Only the *event* is intercepted; message text is never read.
- **Four formulations.** The four accuracy-prompt formulations of Epstein et al.
  (2021): evaluation, importance, tips, normative.
- **Adaptive selection (multi-armed bandit).** Which formulation is shown is
  chosen by a simple bandit (epsilon-greedy). During controlled walk-through
  sessions this is set to **uniform** mode so every formulation gets equal
  exposure; an **adaptive** mode is available outside the study.
- **Local telemetry + dashboard.** Each interaction (session, formulation,
  language, outcome, timestamp — never content) is recorded to
  `chrome.storage.local` and viewable in a companion dashboard.
- **English + Kinyarwanda.** Kinyarwanda strings are author **drafts** and show a
  "not reviewed" warning until a native speaker signs off.

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
  the message stays in the box. Choose *Let me reconsider*, *Share anyway*, or
  *Cancel*. After *Share anyway*, send again and it passes through.
- **Ctrl + Shift + P** — preview the next formulation without sending.
- **Ctrl + Shift + L** — toggle language (English ⇄ Kinyarwanda draft).
- Click the **extension icon** for the popup (language, session id, dashboard link).
- Open the **companion dashboard** from the popup to see recorded events, with
  Export-JSON and Clear.

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
    index.ts          content-script entry: wires interceptor + selector + telemetry
    interceptor.ts     capture-phase Send/Enter interception (centralised WA selectors)
    overlay.ts         the prompt overlay, rendered in a Shadow DOM (style-isolated)
    content-data.ts    the four formulations + UI strings (EN final, RW draft)
    selector.ts        multi-armed bandit formulation selector (uniform | adaptive)
    telemetry.ts       interaction-event model + chrome.storage helpers
  background/
    service-worker.ts  minimal message bus / future backend-sync point
  popup/               extension popup (language, session, dashboard link)
  dashboard/           companion dashboard (reads local telemetry)
```

## Machine-learning component (formulation selector)

Which formulation is shown is chosen by a **multi-armed bandit** (epsilon-greedy),
implemented in `src/content/selector.ts`:

- **In the extension:** the companion dashboard shows the bandit's live per-arm
  statistics (times shown, reflective-outcome rate, and the favoured arm in
  adaptive mode), so the selector's state is inspectable, not just asserted.
- **Offline simulation:** `simulation/` contains a notebook
  (`bandit_simulation.ipynb`) and script (`simulate.py`) that run the *same*
  policy over many synthetic interactions and plot convergence and regret. This
  demonstrates the algorithm learns, using **assumed illustrative** reflective
  rates (not findings — see that folder's README).
- During walk-through sessions the selector runs in **uniform mode** (equal
  exposure) for a fair comparison; adaptive mode is for outside the study. A
  **contextual** bandit (personalising by user/context) is future work.

## Deployment plan

This is a Stage I research prototype; "deployment" means distribution to
walk-through facilitators and participants, not a public release.

**Current (walk-through stage).**
- Distributed as an **unpacked extension** loaded via `chrome://extensions` on a
  researcher-provided laptop, or packaged as a `.zip` / `.crx` for sideloading.
- All data stays **local** to the browser (`chrome.storage.local`); the
  researcher exports session events as JSON from the dashboard after each session.
- No server, no account, no network calls — which keeps the ethics footprint
  minimal (zero host permissions beyond local storage).

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
- **Kinyarwanda strings are unreviewed drafts** and are flagged as such in the UI.
- **The bandit is disabled (uniform mode) during walk-throughs** by design, so the
  qualitative comparison of formulations stays clean.
