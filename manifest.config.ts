import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'AccuPrompt (prototype)',
  version: '0.2.0',
  description:
    'Accuracy-prompt prototype: a brief reflection cue shown at the moment of sharing. Research prototype.',
  // storage: used only to persist anonymous interaction telemetry and bandit
  // state locally. No host/content permissions; no message content is accessed.
  permissions: ['storage'],
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
      matches: ['https://web.whatsapp.com/*'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
  ],
  // The companion dashboard is an extension page that reads local telemetry.
  web_accessible_resources: [
    {
      resources: ['src/dashboard/dashboard.html'],
      matches: ['https://web.whatsapp.com/*'],
    },
  ],
});
