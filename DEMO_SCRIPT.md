# AccuPrompt — Demo Video Script (5–10 minutes)

Rubric reminder: *focus on demonstrating functionality, not on research background.*
Keep intro to ~30 seconds. Have WhatsApp Web already open and logged in, the
extension already loaded, and a chat with yourself (or a test contact) ready.

**Before you record:**
- Build and load the extension (`npm run build` → load `dist/`).
- Open `chrome://extensions` in a tab (to show it's loaded).
- Open WhatsApp Web, logged in, with a test chat open.
- Open DevTools console (F12) so the `[AccuPrompt]` logs are visible.
- Have the popup and dashboard ready to open.

---

## 0:00–0:30 — Intro (keep it short)

> "This is AccuPrompt, a browser extension that shows a brief accuracy prompt at
> the moment someone shares on WhatsApp Web, to encourage a quick check before
> forwarding. I'll demo the working functionality."

Show the `chrome://extensions` tab briefly — AccuPrompt loaded, version 0.2.0,
one permission (`storage`).

## 0:30–1:15 — It loads and injects

- Switch to WhatsApp Web. Show the DevTools console.
- Point to the lines: `[AccuPrompt] content script loaded`, the session id, and
  `interceptor installed (click + Enter, capture phase)`.

> "On load it injects a content script and installs the interceptor. It requests
> no host permissions and never reads message content."

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
  "draft translation — not reviewed" warning.

> "It supports Kinyarwanda, but those strings are drafts pending native-speaker
> review, so the UI flags them and won't let them be mistaken for final."

## 4:00–5:00 — The popup

- Click the extension icon.

> "The popup shows the status, the language toggle, the current session id, and a
> link to the companion dashboard. It restates that no message content is stored."

- Toggle the language here to show it persists.

## 5:00–6:30 — The companion dashboard

- From the popup, click **Open companion dashboard**.

> "Every interaction is logged locally — session, formulation, language, outcome,
> timestamp — never the message content."

- Walk through the summary tiles (sessions, prompts shown, reconsidered, % paused).
- Scroll the events table; point out the colour-coded outcomes.
- Click **Export JSON** → show the downloaded file (this is what a researcher would
  take from each walk-through session).
- (Optionally) show **Refresh** picking up a new event after you trigger one more
  prompt in the WhatsApp tab.

> "There's no backend in this prototype — data stays in the browser and the
> researcher exports it per session. A server-side sync is specified as future
> work in the proposal."

## 6:30–7:30 — Wrap (brief)

- Show the repo structure briefly (the `src/` folders) and the README.

> "To recap: it intercepts the share at the right moment without touching the
> message, offers four research-based formulations selected by a bandit, supports
> English and draft Kinyarwanda, and logs anonymous outcomes to a local dashboard.
> Next steps are the reviewed Kinyarwanda translation and the specified backend."

Stop recording. Total ~7–8 minutes, comfortably within the 5–10 window.

---

### Tips
- If interception ever fails to fire mid-recording, it's almost certainly a
  WhatsApp selector change — the fix is the `WA` block in `interceptor.ts`. Do a
  dry run right before recording.
- Use a test chat / chat-with-yourself so any "Share anyway" sends are harmless.
- Keep narration on *what it does*, not the literature — the rubric is explicit.
