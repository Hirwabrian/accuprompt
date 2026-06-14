"""
simulate.py — Monte Carlo simulation of the AccuPrompt formulation selector.

WHAT THIS SHOWS (and what it does NOT):
  - It demonstrates that the implemented epsilon-greedy bandit, run over many
    interactions, learns to favour the formulation with the higher reflective
    rate, and accrues less regret than uniform (random-equal) selection.
  - The per-formulation "true reflective rates" below are ASSUMED VALUES chosen
    for illustration. They are NOT empirical findings and do NOT claim any
    formulation is actually better for real users. The simulation validates the
    ALGORITHM, not the formulations. Real reflective rates would come from the
    cognitive walk-throughs / a deployed study.

Outputs PNGs into simulation/figures/.
"""

from __future__ import annotations
import os
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from bandit import EpsilonGreedyBandit, UniformSelector, FORMULATIONS

FIG_DIR = os.path.join(os.path.dirname(__file__), "figures")
os.makedirs(FIG_DIR, exist_ok=True)

# --- ASSUMED true reflective rates (ILLUSTRATIVE — not findings) ---
TRUE_RATES = {
    "evaluation": 0.55,
    "importance": 0.42,
    "tips": 0.48,
    "normative": 0.38,
}
BEST_ARM = max(TRUE_RATES, key=TRUE_RATES.get)
BEST_RATE = TRUE_RATES[BEST_ARM]

GREEN = "#14764f"
GREEN_DK = "#0f5e3f"
MUTE = "#8294a0"
SLATE = "#3a4b56"
INK = "#16242e"
COLORS = ["#4A6FA5", "#B98B36", "#5A8C5A", "#6A4A8C"]


def simulate(selector_factory, n_steps: int, seed: int):
    """Run one selector for n_steps; return (cumulative_regret, arm_choice_history)."""
    rng_py = __import__("random").Random(seed)
    rng_np = np.random.default_rng(seed)
    sel = selector_factory(rng_py)
    cum_regret = np.zeros(n_steps)
    choices = []
    running = 0.0
    for t in range(n_steps):
        arm = sel.select()
        # synthetic user: reflective outcome with prob = TRUE_RATES[arm]
        reward = 1.0 if rng_np.random() < TRUE_RATES[arm] else 0.0
        sel.update(arm, reward)
        # regret = best possible expected reward - this arm's expected reward
        running += (BEST_RATE - TRUE_RATES[arm])
        cum_regret[t] = running
        choices.append(arm)
    return cum_regret, choices


def avg_over_runs(selector_factory, n_steps, n_runs):
    regrets = np.zeros((n_runs, n_steps))
    arm_counts_over_time = {f: np.zeros(n_steps) for f in FORMULATIONS}
    for r in range(n_runs):
        regret, choices = simulate(selector_factory, n_steps, seed=1000 + r)
        regrets[r] = regret
        # cumulative share of each arm over time
        counts = {f: 0 for f in FORMULATIONS}
        for t, a in enumerate(choices):
            counts[a] += 1
            for f in FORMULATIONS:
                arm_counts_over_time[f][t] += counts[f] / (t + 1)
    mean_regret = regrets.mean(axis=0)
    arm_share = {f: arm_counts_over_time[f] / n_runs for f in FORMULATIONS}
    return mean_regret, arm_share


def main():
    N_STEPS = 600
    N_RUNS = 200

    bandit_factory = lambda rng: EpsilonGreedyBandit(rng=rng)
    uniform_factory = lambda rng: UniformSelector(rng=rng)

    b_regret, b_share = avg_over_runs(bandit_factory, N_STEPS, N_RUNS)
    u_regret, _ = avg_over_runs(uniform_factory, N_STEPS, N_RUNS)

    # --- Figure 1: cumulative regret, bandit vs uniform ---
    fig, ax = plt.subplots(figsize=(8, 4.6), dpi=130)
    ax.plot(b_regret, color=GREEN, lw=2.2, label="Epsilon-greedy bandit")
    ax.plot(u_regret, color=MUTE, lw=2.2, ls="--", label="Uniform (equal exposure)")
    ax.set_xlabel("Interaction number")
    ax.set_ylabel("Cumulative regret")
    ax.set_title("Bandit accrues less regret than uniform selection over time",
                 color=INK, fontsize=12, fontweight="bold")
    ax.legend(frameon=False)
    ax.spines[["top", "right"]].set_visible(False)
    ax.grid(axis="y", alpha=0.15)
    fig.tight_layout()
    fig.savefig(os.path.join(FIG_DIR, "regret.png"), bbox_inches="tight")
    plt.close(fig)

    # --- Figure 2: arm-selection share over time (bandit converges to best) ---
    fig, ax = plt.subplots(figsize=(8, 4.6), dpi=130)
    for i, f in enumerate(FORMULATIONS):
        label = f + (" (best, assumed)" if f == BEST_ARM else "")
        ax.plot(b_share[f], color=COLORS[i], lw=2.2 if f == BEST_ARM else 1.6,
                label=label)
    ax.set_xlabel("Interaction number")
    ax.set_ylabel("Cumulative share of selections")
    ax.set_title("Bandit shifts selection toward the higher-reflective-rate arm",
                 color=INK, fontsize=12, fontweight="bold")
    ax.legend(frameon=False, fontsize=9)
    ax.spines[["top", "right"]].set_visible(False)
    ax.grid(axis="y", alpha=0.15)
    ax.set_ylim(0, 1)
    fig.tight_layout()
    fig.savefig(os.path.join(FIG_DIR, "arm_share.png"), bbox_inches="tight")
    plt.close(fig)

    # --- Figure 3: assumed true rates vs what the bandit estimated (one long run) ---
    sel = EpsilonGreedyBandit(rng=__import__("random").Random(7))
    rng_np = np.random.default_rng(7)
    for _ in range(3000):
        a = sel.select()
        sel.update(a, 1.0 if rng_np.random() < TRUE_RATES[a] else 0.0)
    est = [sel.arms[f].rate for f in FORMULATIONS]
    true = [TRUE_RATES[f] for f in FORMULATIONS]
    x = np.arange(len(FORMULATIONS))
    w = 0.38
    fig, ax = plt.subplots(figsize=(8, 4.6), dpi=130)
    ax.bar(x - w/2, true, w, label="Assumed true rate", color=MUTE)
    ax.bar(x + w/2, est, w, label="Bandit estimate (3000 interactions)", color=GREEN)
    ax.set_xticks(x)
    ax.set_xticklabels(FORMULATIONS)
    ax.set_ylabel("Reflective-outcome rate")
    ax.set_title("Bandit's learned estimates approach the assumed true rates",
                 color=INK, fontsize=12, fontweight="bold")
    ax.legend(frameon=False)
    ax.spines[["top", "right"]].set_visible(False)
    ax.grid(axis="y", alpha=0.15)
    ax.set_ylim(0, 0.7)
    fig.tight_layout()
    fig.savefig(os.path.join(FIG_DIR, "estimates.png"), bbox_inches="tight")
    plt.close(fig)

    # console summary
    final_share = {f: round(float(b_share[f][-1]), 3) for f in FORMULATIONS}
    print("Best arm (assumed):", BEST_ARM, "@", BEST_RATE)
    print("Final selection share (bandit):", final_share)
    print("Final cumulative regret — bandit: %.1f | uniform: %.1f"
          % (b_regret[-1], u_regret[-1]))
    print("Figures written to", FIG_DIR)


if __name__ == "__main__":
    main()
