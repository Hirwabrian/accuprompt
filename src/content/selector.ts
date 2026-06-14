/**
 * Formulation selector.
 *
 * Implements the adaptive formulation selection described in the proposal
 * (Section 3.8.4): a simple multi-armed bandit over the four Epstein et al.
 * (2021) formulations. Two policies are provided:
 *
 *   - "uniform"  : every formulation is shown an equal number of times, in a
 *                  shuffled round-robin. Used DURING controlled walk-through
 *                  sessions so the qualitative comparison stays clean.
 *   - "adaptive" : an epsilon-greedy multi-armed bandit that prefers the
 *                  formulation with the best observed reflective-outcome rate,
 *                  while still exploring. Used outside the controlled study.
 *
 * The bandit is non-contextual: it adapts to aggregate outcomes only, not to
 * the individual user or message. A contextual extension is future work.
 *
 * Reward signal (defined without reading message content):
 *   reflective outcome (the user pauses to reconsider, or cancels) -> reward 1
 *   immediate share ("proceed")                                    -> reward 0
 *
 * State persists in chrome.storage.local so learning survives page reloads.
 */

import { VARIANTS, type FormulationType } from './content-data';
import type { PromptOutcome } from './overlay';

export type SelectorPolicy = 'uniform' | 'adaptive';

/** Per-formulation tally: times shown, and sum of rewards. */
interface ArmStats {
  shown: number;
  reward: number;
}

interface SelectorState {
  policy: SelectorPolicy;
  arms: Record<FormulationType, ArmStats>;
  /** Round-robin bag for uniform mode (shuffled formulation ids to deal out). */
  bag: FormulationType[];
}

export const SELECTOR_KEY = 'accuprompt.selector.v1';
const STORAGE_KEY = SELECTOR_KEY;
const EPSILON = 0.25; // exploration rate for the adaptive policy

const ALL_IDS: FormulationType[] = VARIANTS.map((v) => v.id);

function freshArms(): Record<FormulationType, ArmStats> {
  const a = {} as Record<FormulationType, ArmStats>;
  for (const id of ALL_IDS) a[id] = { shown: 0, reward: 0 };
  return a;
}

function shuffled<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function load(policy: SelectorPolicy): Promise<SelectorState> {
  try {
    const got = await chrome.storage.local.get(STORAGE_KEY);
    const saved = got[STORAGE_KEY] as SelectorState | undefined;
    if (saved && saved.arms) {
      saved.policy = policy; // policy is controlled by the session, not storage
      if (!saved.bag) saved.bag = [];
      return saved;
    }
  } catch {
    /* storage unavailable; fall through to fresh state */
  }
  return { policy, arms: freshArms(), bag: [] };
}

async function save(state: SelectorState): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: state });
  } catch {
    /* best-effort; selection still works in-memory this session */
  }
}

/** The reflective outcomes that count as reward. */
function rewardFor(outcome: PromptOutcome): number {
  return outcome === 'proceed' ? 0 : 1; // edit or cancel = reflective
}

export class FormulationSelector {
  private policy: SelectorPolicy;
  private state: SelectorState | null = null;

  constructor(policy: SelectorPolicy) {
    this.policy = policy;
  }

  private async ensure(): Promise<SelectorState> {
    if (!this.state) this.state = await load(this.policy);
    return this.state;
  }

  /** Choose the next formulation to present. */
  async next(): Promise<FormulationType> {
    const s = await this.ensure();

    if (this.policy === 'uniform') {
      // Deal from a shuffled bag; refill when empty -> equal exposure.
      if (s.bag.length === 0) s.bag = shuffled(ALL_IDS);
      const pick = s.bag.pop() as FormulationType;
      await save(s);
      return pick;
    }

    // adaptive: epsilon-greedy
    // Always try any never-shown arm first (optimistic initialisation).
    const unseen = ALL_IDS.filter((id) => s.arms[id].shown === 0);
    if (unseen.length > 0) return unseen[Math.floor(Math.random() * unseen.length)];

    if (Math.random() < EPSILON) {
      // explore
      return ALL_IDS[Math.floor(Math.random() * ALL_IDS.length)];
    }
    // exploit: best mean reward so far
    let best = ALL_IDS[0];
    let bestRate = -1;
    for (const id of ALL_IDS) {
      const { shown, reward } = s.arms[id];
      const rate = shown > 0 ? reward / shown : 0;
      if (rate > bestRate) { bestRate = rate; best = id; }
    }
    return best;
  }

  /** Record the outcome of a shown formulation, updating the bandit. */
  async record(variant: FormulationType, outcome: PromptOutcome): Promise<void> {
    const s = await this.ensure();
    s.arms[variant].shown += 1;
    s.arms[variant].reward += rewardFor(outcome);
    await save(s);
  }

  /** Expose current stats (for debugging / the dashboard). */
  async stats(): Promise<Record<FormulationType, ArmStats>> {
    const s = await this.ensure();
    return s.arms;
  }
}
