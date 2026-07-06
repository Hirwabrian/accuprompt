# AccuPrompt — Demo Video Script (5–10 minutes)

Rubric reminder: *focus on demonstrating functionality, not on research background.*
Keep intro to ~30 seconds. Have WhatsApp Web already open and logged in, the
extension already loaded, and a chat with yourself (or a test contact) ready.

**Before you record:**
- Build and load the extension (`npm run build` → load `dist/`).
- **Start the retrieval backend** (for the evidence-panel beat):
  `cd rag_build && uvicorn backend:app --port 8000` (drop `--reload` for a clean
  recording). Confirm `http://127.0.0.1:8000/health`. Start it *before* WhatsApp Web.
- Open `chrome://extensions` in a tab (to show it's loaded).
- Open WhatsApp Web, logged in, with a test chat open.
- Open DevTools console (F12) so the `[AccuPrompt]` logs are visible.
- In the popup, set the study-arm toggles to **Evidence on** and **Smart trigger**
  for the full demo.
- Have a known-in-corpus claim ready to paste (e.g. *"vaccines cause autism in 1
  of 3 children according to a new study"*) — the panel only appears for claims in
  the corpus.

---

## 0:00–0:30 — Intro (keep it short)

> "This is AccuPrompt, a browser extension that shows a brief accuracy prompt at
> the moment someone shares on WhatsApp Web, to encourage a quick check before
> forwarding. I'll demo the working functionality."

Show the `chrome://extensions` tab briefly — AccuPrompt loaded (v0.3.0), with
permissions limited to storage, WhatsApp Web, and localhost.

## 0:30–1:15 — It loads and injects

- Switch to WhatsApp Web. Show the DevTools console.
- Point to the lines: `[AccuPrompt] content script loaded`, the session id, and
  `interceptor installed (click + Enter, capture phase)`.

> "On load it injects a content script and installs the interceptor. Its host
> permissions are limited to WhatsApp Web and a localhost fact-check service —
> message text is inspected locally to decide whether to prompt and is never
> stored."

## 1:15–3:00 — The core: interception at the moment of sharing

- Type a test message (e.g. "Testing the accuracy prompt").
- **Click Send.** The prompt appears; the message stays in the box, unsent.

> "When I click Send, the extension catches the click *before* WhatsApp handles
> it, and shows the prompt. The message hasn't been sent — it's still in the box."

- Point out the three options and the autonomy note.
- Click **Let me reconsider** → prompt closes, message still there.

> "If I reconsider, nothing is sent and my message is untouched."

- Click Send again, this time choose **Share anyway** → prompt closes; click Send
  once more → it sends.

> "If I choose to share anyway, I just send again and it goes through."

- Type another message and press **Enter** (not the button) → prompt fires again.

> "It also catches the Enter key, not just the button — so you can't bypass it by
> pressing Enter."

## 3:00–4:00 — The four formulations + adaptive selection

- Use **Ctrl + Shift + P** a few times to cycle the prompt; show the headline/body
  changing across evaluation, importance, tips, normative.

> "There are four prompt formulations from the research literature. Which one
> shows is chosen by a simple multi-armed bandit — a basic reinforcement-learning
> selector. During the actual walk-through study it runs in uniform mode so every
> formulation gets equal exposure; the adaptive mode is for outside the study."

- **Ctrl + Shift + L** → toggle to Kinyarwanda; show a prompt; point out the amber
  "draft translation — not reviewed" warning. Note the toast confirming the switch.

> "It supports Kinyarwanda, but those strings are drafts pending native-speaker
> review, so the UI flags them and won't let them be mistaken for final."

## 4:00–4:45 — The triggering gate (don't prompt on everything)

- With **Smart trigger** on, send a trivial message ("ok", "see you at 6") → **no
  prompt appears**. Point to the console line `gate: no prompt — short / no claim
  signals`.
- Then send a claim-like message → the prompt appears as before.

> "The extension doesn't interrupt every message. A structural gate decides
> whether a send is worth prompting on — based on length, links, and numerals, not
> on reading the meaning. Trivial messages pass through; claim-shaped ones get the
> prompt. The gate can be turned off, in which case it prompts on every send."

## 4:45–5:45 — The evidence panel (retrieval-only RAG)

- Paste the known-in-corpus claim (e.g. *"vaccines cause autism in 1 of 3
  children…"*) and trigger the prompt.
- Expand **"See related fact-checks"**. Show the retrieved claim, the colour-coded
  verdict label, and the human-written justification, plus the source link.
- Point to the backend terminal: a `POST /retrieve 200 OK` line proves the live
  round-trip.
- Toggle to Kinyarwanda (**Ctrl + Shift + L**) and re-open the panel: the
  justification now shows in Kinyarwanda with the "auto-translated, not reviewed"
  banner, and the label shows a draft word marked "(agateganyo)".

> "When enabled, the prompt can show related fact-checks retrieved from a local
> corpus of real human fact-checks. This is retrieval-only — there's no language
> model generating text, so it can't invent or flip a verdict. It runs against a
> service on my own machine; only the claim is sent, never the message. For most
> messages it shows nothing, which is the honest behaviour — it only speaks when
> there's a real match."

## 5:45–6:15 — The popup (study arms)

- Click the extension icon.

> "The popup shows status, the language toggle, the two study-arm switches —
> evidence panel on/off and smart-trigger on/off — the session id, and the
> dashboard link. These let a facilitator set the A/B arm without touching code,
> while the formulation schedule stays constant."

- Toggle the language here to show it applies to the live tab and persists.

## 6:15–7:15 — The companion dashboard

- From the popup, click **Open companion dashboard**.

> "Every interaction is logged locally — session, formulation, language, outcome,
> timestamp — never the message content."

- Walk through the summary tiles (sessions, prompts shown, % paused, **gate skips,
  evidence panels opened**).
- Scroll the events table; point out the colour-coded outcomes and the gate-skip
  rows.
- Click **Export JSON** → show the downloaded file (what a researcher takes from
  each session).

> "Telemetry stays in the browser and the researcher exports it per session. The
> only network call is to the local fact-check service; a server-side sync remains
> specified as future work."

## 7:15–8:00 — Wrap (brief)

- Show the repo structure briefly (the `src/` folders, `rag_build/`) and the README.

> "To recap: it intercepts the share at the right moment without touching the
> message; a structural gate keeps it from prompting on trivial messages; it offers
> four research-based formulations selected by a bandit; an optional retrieval-only
> panel surfaces related human fact-checks from a local corpus; and it supports
> English and draft Kinyarwanda, logging anonymous outcomes to a local dashboard.
> Next steps are the reviewed Kinyarwanda translation, and a second platform —
> X/Twitter — whose explicit Repost action the architecture is already designed
> for."

Stop recording. Total ~8 minutes, comfortably within the 5–10 window.

---

### Tips
- If interception ever fails to fire mid-recording, it's almost certainly a
  WhatsApp selector change — the fix is the `WA` block in `interceptor.ts`. Do a
  dry run right before recording.
- **If the evidence panel doesn't appear:** check the backend terminal is running
  and `http://127.0.0.1:8000/health` responds, and that you used a *known-in-corpus*
  claim. With the 0.5 threshold, out-of-corpus messages correctly show no panel.
- **If the gate suppresses a message you wanted to demo:** it needs a claim-like
  signal (length, a link, or numerals). Use the prepared claim, not a short phrase.
- Run the backend **without** `--reload` for recording, so it can't restart
  mid-take.
- Use a test chat / chat-with-yourself so any "Share anyway" sends are harmless.
- Keep narration on *what it does*, not the literature — the rubric is explicit.
