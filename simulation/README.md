# Formulation Selector Simulation

This folder demonstrates the **multi-armed bandit** that AccuPrompt uses to choose
which of the four accuracy-prompt formulations to show. It runs the **same
epsilon-greedy policy** as the extension (`../src/content/selector.ts`), ported to
Python in `bandit.py`.

## Files
- `bandit.py` — Python port of the selector (epsilon-greedy + uniform), kept in
  sync with `selector.ts`.
- `simulate.py` — Monte Carlo simulation; writes plots to `figures/`.
- `bandit_simulation.ipynb` — annotated notebook (the ML deliverable) with the
  same analysis and inline plots. Already executed; open to read, or re-run.
- `figures/` — generated plots: `regret.png`, `arm_share.png`, `estimates.png`.

## Run it
```bash
pip install numpy matplotlib
python simulate.py                 # regenerate the figures
# or open bandit_simulation.ipynb in Jupyter and Run All
```

## What it shows — and what it does NOT
It shows the implemented bandit **learns**: it concentrates selection on the
higher-reflective-rate formulation and accrues **sub-linear regret**, beating
uniform selection.

**The per-formulation reflective rates are assumed, illustrative values — not
findings.** The simulation validates the *algorithm*, not the formulations. Real
rates would come from the cognitive walk-throughs or a deployed study. During the
actual walk-through study the extension runs the selector in **uniform mode** for
fair comparison; the adaptive behaviour shown here is for use outside the study.
The contextual (personalised) bandit is future work.
