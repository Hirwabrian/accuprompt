import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'AccuPrompt (prototype)',
  version: '0.3.0',
  description:
    'Accuracy-prompt prototype: a brief reflection cue shown at the moment of sharing. Research prototype.',
  // storage: anonymous local telemetry + bandit state.
  // host_permissions: allows the content script to call the LOCAL retrieval
  // backend (RAG) at 127.0.0.1:8000. No remote hosts; nothing is sent off-device.
  permissions: ['storage'],
  host_permissions: ['http://127.0.0.1:8000/*', 'http://localhost:8000/*'],
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  action: {
    default_title: 'AccuPrompt',
    default_popup: 'src/popup/popup.html',
  },
  content_scripts: [
    {
      matches: ['https://web.whatsapp.com/*', 'https://www.messenger.com/*', 'https://messenger.com/*', 'https://x.com/*', 'https://twitter.com/*', 'https://www.facebook.com/*', 'https://facebook.com/*'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
  ],
  // The companion dashboard is an extension page that reads local telemetry.
  web_accessible_resources: [
    {
      resources: ['src/dashboard/dashboard.html'],
      matches: ['https://web.whatsapp.com/*', 'https://www.messenger.com/*', 'https://messenger.com/*', 'https://x.com/*', 'https://twitter.com/*', 'https://www.facebook.com/*', 'https://facebook.com/*'],
    },
  ],
});
