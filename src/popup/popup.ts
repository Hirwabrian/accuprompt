/**
 * Popup logic: shows the current session id, lets the user pick the prompt
 * language, and opens the companion dashboard. Language preference is stored
 * so the content script can read it.
 */

const LANG_KEY = 'accuprompt.lang.v1';
const SESSION_KEY = 'accuprompt.session.v1';

const seg = document.getElementById('lang') as HTMLElement;
const sidEl = document.getElementById('sid') as HTMLElement;
const openDash = document.getElementById('open-dash') as HTMLElement;

// Restore stored language preference.
chrome.storage.local.get([LANG_KEY, SESSION_KEY]).then((got) => {
  const lang = (got[LANG_KEY] as string) || 'en';
  for (const btn of Array.from(seg.querySelectorAll('button'))) {
    btn.classList.toggle('sel', btn.getAttribute('data-lang') === lang);
  }
  sidEl.textContent = (got[SESSION_KEY] as string) || 'not started';
});

seg.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('button');
  if (!btn) return;
  const lang = btn.getAttribute('data-lang')!;
  for (const b of Array.from(seg.querySelectorAll('button'))) {
    b.classList.toggle('sel', b === btn);
  }
  void chrome.storage.local.set({ [LANG_KEY]: lang });
});

openDash.addEventListener('click', () => {
  const url = chrome.runtime.getURL('src/dashboard/dashboard.html');
  void chrome.tabs.create({ url });
});
