/**
 * Prompt content catalogue.
 *
 * The four formulations are adapted from the accuracy-prompt toolkit of
 * Epstein, Berinsky, Cole, Gully, Pennycook & Rand (2021), "Developing an
 * accuracy-prompt toolkit to reduce COVID-19 misinformation online",
 * HKS Misinformation Review.
 *
 * IMPORTANT — LOCALISATION STATUS:
 * The English strings are final-draft quality.
 * The Kinyarwanda strings (lang "rw") are UNREVIEWED MACHINE-/AUTHOR-DRAFTS
 * and MUST be reviewed and corrected by a native Kinyarwanda speaker before
 * any participant session. Each carries reviewed: false until a human
 * reviewer signs off (set reviewed: true and fill reviewedBy).
 * Do not run a walk-through on unreviewed strings.
 */

export type Lang = 'en' | 'rw';

export type FormulationType =
  | 'evaluation'
  | 'importance'
  | 'tips'
  | 'normative';

export interface PromptStrings {
  reviewed: boolean;
  reviewedBy?: string;
  headline: string;
  body: string;
}

export interface PromptVariant {
  id: FormulationType;
  /** Source attribution for the formulation. */
  source: string;
  strings: Record<Lang, PromptStrings>;
}

export interface UiStrings {
  reviewed: boolean;
  reviewedBy?: string;
  proceed: string;
  edit: string;
  cancel: string;
  /** Small print shown under the buttons. */
  note: string;
}

export const UI: Record<Lang, UiStrings> = {
  en: {
    reviewed: true,
    proceed: 'Share anyway',
    edit: 'Let me reconsider',
    cancel: 'Cancel',
    note: 'You decide. This is only a reminder, not a judgement about your message.',
  },
  rw: {
    reviewed: false,
    proceed: 'Ohereza uko biri', // DRAFT — review needed
    edit: 'Reka mbanze ntekereze', // DRAFT — review needed
    cancel: 'Hagarika', // DRAFT — review needed
    note: 'Ni wowe ufata icyemezo. Iyi ni inyibutsa gusa, si urubanza ku butumwa bwawe.', // DRAFT — review needed
  },
};

export const VARIANTS: PromptVariant[] = [
  {
    id: 'evaluation',
    source: 'Epstein et al. (2021), evaluation formulation',
    strings: {
      en: {
        reviewed: true,
        headline: 'Is this accurate?',
        body: 'Before you share, take a moment to consider whether you believe this information is accurate.',
      },
      rw: {
        reviewed: false,
        headline: 'Ese ibi ni ukuri?', // DRAFT — review needed
        body: 'Mbere yo kubisangiza, fata akanya utekereze niba wizera ko aya makuru ari ukuri.', // DRAFT — review needed
      },
    },
  },
  {
    id: 'importance',
    source: 'Epstein et al. (2021), importance formulation',
    strings: {
      en: {
        reviewed: true,
        headline: 'Accuracy matters',
        body: 'Sharing only accurate information helps everyone. Is this something you are confident is true?',
      },
      rw: {
        reviewed: false,
        headline: 'Ukuri ni ingenzi', // DRAFT — review needed
        body: 'Gusangiza gusa amakuru ari ukuri bifasha buri wese. Ese ibi ni ikintu wizeye ko ari ukuri?', // DRAFT — review needed
      },
    },
  },
  {
    id: 'tips',
    source: 'Epstein et al. (2021), tips formulation',
    strings: {
      en: {
        reviewed: true,
        headline: 'A quick check',
        body: 'Consider the source, check whether other outlets report it, and be cautious if it seems designed to provoke a strong reaction.',
      },
      rw: {
        reviewed: false,
        headline: 'Isuzuma ryihuse', // DRAFT — review needed
        body: 'Reba aho byavuye, urebe niba n\u2019ahandi babivuga, kandi witondere niba bisa n\u2019ibigamije gukongeza amarangamutima.', // DRAFT — review needed
      },
    },
  },
  {
    id: 'normative',
    source: 'Epstein et al. (2021), normative formulation',
    strings: {
      en: {
        reviewed: true,
        headline: 'Most people value accuracy',
        body: 'Most people think it is important to share only information that is accurate. Does this meet that standard?',
      },
      rw: {
        reviewed: false,
        headline: 'Abenshi baha agaciro ukuri', // DRAFT — review needed
        body: 'Abantu benshi batekereza ko ari ingenzi gusangiza gusa amakuru ari ukuri. Ese ibi bihuje n\u2019icyo gipimo?', // DRAFT — review needed
      },
    },
  },
];
