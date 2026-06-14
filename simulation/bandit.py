"""
bandit.py — Python port of the AccuPrompt formulation selector.

This mirrors the epsilon-greedy policy implemented in the extension at
src/content/selector.ts. It is reproduced here (not re-invented) so the
simulation exercises the SAME decision logic the extension uses. Keep the two
in sync: the policy below must match selector.ts.

Policy (adaptive / epsilon-greedy):
  - Any never-shown arm is tried first (optimistic initialisation).
  - With probability EPSILON, explore: pick a uniformly random arm.
  - Otherwise exploit: pick the arm with the highest mean reward so far.

Reward: a reflective outcome (the user reconsiders or cancels) = 1; an
immediate share = 0. This matches the reward defined in telemetry/selector.
"""

from __future__ import annotations
import random
from dataclasses import dataclass, field

EPSILON = 0.25  # must match selector.ts
FORMULATIONS = ["evaluation", "importance", "tips", "normative"]


@dataclass
class Arm:
    shown: int = 0
    reward: float = 0.0

    @property
    def rate(self) -> float:
        return self.reward / self.shown if self.shown > 0 else 0.0


@dataclass
class EpsilonGreedyBandit:
    """Non-contextual epsilon-greedy bandit over the four formulations."""
    epsilon: float = EPSILON
    arms: dict = field(default_factory=lambda: {f: Arm() for f in FORMULATIONS})
    rng: random.Random = field(default_factory=random.Random)

    def select(self) -> str:
        # 1) try any never-shown arm first
        unseen = [f for f, a in self.arms.items() if a.shown == 0]
        if unseen:
            return self.rng.choice(unseen)
        # 2) explore
        if self.rng.random() < self.epsilon:
            return self.rng.choice(FORMULATIONS)
        # 3) exploit: best mean reward
        return max(FORMULATIONS, key=lambda f: self.arms[f].rate)

    def update(self, arm: str, reward: float) -> None:
        self.arms[arm].shown += 1
        self.arms[arm].reward += reward


@dataclass
class UniformSelector:
    """Shuffled round-robin: equal exposure. Used during walk-through sessions."""
    bag: list = field(default_factory=list)
    rng: random.Random = field(default_factory=random.Random)
    arms: dict = field(default_factory=lambda: {f: Arm() for f in FORMULATIONS})

    def select(self) -> str:
        if not self.bag:
            self.bag = FORMULATIONS.copy()
            self.rng.shuffle(self.bag)
        return self.bag.pop()

    def update(self, arm: str, reward: float) -> None:
        self.arms[arm].shown += 1
        self.arms[arm].reward += reward
