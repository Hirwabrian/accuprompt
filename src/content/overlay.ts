/**
 * AccuPrompt overlay.
 *
 * Renders the accuracy prompt inside a Shadow DOM so that:
 *   (a) WhatsApp's CSS cannot affect our styling, and
 *   (b) our CSS cannot leak into WhatsApp's page.
 *
 * For steps 1-3 the overlay is purely presentational: it shows a prompt and
 * reports which button the user pressed via a callback. It does NOT read,
 * store, or transmit any message content, and it is not yet wired to the
 * real send action (that is step 4).
 */

import { VARIANTS, UI, type Lang, type FormulationType } from './content-data';

export type PromptOutcome = 'proceed' | 'edit' | 'cancel';

export interface ShowOptions {
  lang: Lang;
  variant: FormulationType;
  onOutcome: (outcome: PromptOutcome) => void;
}

const HOST_ID = 'accuprompt-overlay-host';

const STYLE = `
  :host { all: initial; }
  * { box-sizing: border-box; }

  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 32, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    animation: fade 140ms ease-out;
  }
  @keyframes fade { from { opacity: 0; } to { opacity: 1; } }

  .card {
    width: min(420px, calc(100vw - 48px));
    background: #ffffff;
    border-radius: 14px;
    padding: 28px 26px 22px;
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.32);
    transform: translateY(6px);
    animation: rise 160ms ease-out forwards;
  }
  @keyframes rise { to { transform: translateY(0); } }

  .badge {
    display: inline-block;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #5b7a8c;
    background: #eef4f8;
    border-radius: 999px;
    padding: 4px 10px;
    margin-bottom: 14px;
  }

  .headline {
    margin: 0 0 10px;
    font-size: 19px;
    line-height: 1.3;
    font-weight: 600;
    color: #16242e;
  }

  .body {
    margin: 0 0 22px;
    font-size: 15px;
    line-height: 1.55;
    color: #3a4b56;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 9px;
  }

  button {
    font: inherit;
    font-size: 15px;
    border-radius: 9px;
    padding: 11px 14px;
    cursor: pointer;
    border: 1px solid transparent;
    transition: background 120ms ease, border-color 120ms ease;
  }
  button:focus-visible { outline: 2px solid #2f7db5; outline-offset: 2px; }

  .btn-edit {
    background: #14764f;
    color: #ffffff;
  }
  .btn-edit:hover { background: #0f5e3f; }

  .btn-proceed {
    background: #ffffff;
    color: #2b3a44;
    border-color: #c9d4db;
  }
  .btn-proceed:hover { background: #f2f5f7; }

  .btn-cancel {
    background: transparent;
    color: #6a7b85;
    padding: 8px;
  }
  .btn-cancel:hover { color: #45555f; }

  .note {
    margin: 16px 2px 0;
    font-size: 12.5px;
    line-height: 1.45;
    color: #8294a0;
  }

  .draft-warn {
    margin: 14px 0 0;
    font-size: 12px;
    line-height: 1.4;
    color: #8a5a00;
    background: #fff6e5;
    border: 1px solid #f0d79a;
    border-radius: 8px;
    padding: 8px 10px;
  }
`;

let activeHost: HTMLElement | null = null;

export function dismiss(): void {
  if (activeHost) {
    activeHost.remove();
    activeHost = null;
    document.removeEventListener('keydown', onKeydown, true);
  }
}

let currentOnOutcome: ((o: PromptOutcome) => void) | null = null;

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    const cb = currentOnOutcome;
    dismiss();
    cb?.('cancel');
  }
}

export function showPrompt(opts: ShowOptions): void {
  // Only ever one prompt at a time.
  dismiss();

  const variant = VARIANTS.find((v) => v.id === opts.variant) ?? VARIANTS[0];
  const strings = variant.strings[opts.lang];
  const ui = UI[opts.lang];

  const host = document.createElement('div');
  host.id = HOST_ID;
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = STYLE;
  shadow.appendChild(style);

  const backdrop = document.createElement('div');
  backdrop.className = 'backdrop';

  const card = document.createElement('div');
  card.className = 'card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');

  const unreviewed = !strings.reviewed || !ui.reviewed;

  card.innerHTML = `
    <span class="badge">AccuPrompt</span>
    <h2 class="headline"></h2>
    <p class="body"></p>
    <div class="actions">
      <button class="btn-edit"></button>
      <button class="btn-proceed"></button>
      <button class="btn-cancel"></button>
    </div>
    <p class="note"></p>
    ${unreviewed ? '<p class="draft-warn">Draft translation — not yet reviewed by a native speaker. Do not use in a live session.</p>' : ''}
  `;

  // Set text via textContent (never innerHTML) so content can't inject markup.
  (card.querySelector('.headline') as HTMLElement).textContent = strings.headline;
  (card.querySelector('.body') as HTMLElement).textContent = strings.body;
  (card.querySelector('.note') as HTMLElement).textContent = ui.note;

  const editBtn = card.querySelector('.btn-edit') as HTMLButtonElement;
  const proceedBtn = card.querySelector('.btn-proceed') as HTMLButtonElement;
  const cancelBtn = card.querySelector('.btn-cancel') as HTMLButtonElement;
  editBtn.textContent = ui.edit;
  proceedBtn.textContent = ui.proceed;
  cancelBtn.textContent = ui.cancel;

  const finish = (outcome: PromptOutcome) => {
    dismiss();
    opts.onOutcome(outcome);
  };

  editBtn.addEventListener('click', () => finish('edit'));
  proceedBtn.addEventListener('click', () => finish('proceed'));
  cancelBtn.addEventListener('click', () => finish('cancel'));
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) finish('cancel');
  });

  backdrop.appendChild(card);
  shadow.appendChild(backdrop);
  document.documentElement.appendChild(host);

  activeHost = host;
  currentOnOutcome = opts.onOutcome;
  document.addEventListener('keydown', onKeydown, true);

  // Move focus into the dialog for keyboard users.
  editBtn.focus();
}
