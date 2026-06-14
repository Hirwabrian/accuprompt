// Mounts the real overlay over the mock background for visual review.
import { showPrompt } from '../src/content/overlay';

const params = new URLSearchParams(location.search);
const lang = (params.get('lang') === 'rw' ? 'rw' : 'en');
const variant = (params.get('variant') || 'evaluation');

showPrompt({
  lang,
  variant,
  onOutcome: (o) => console.log('outcome', o),
});
