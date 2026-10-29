"""Render the report charts from measurements.json; no backend access required."""

import json
import statistics
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parent
DATA = json.loads((ROOT / "measurements.json").read_text())
plt.rcParams.update({"font.size": 11, "font.family": "DejaVu Sans"})


def chart(filename, title, labels, samples, colors, footnote):
    means = [statistics.mean(values) for values in samples]
    fig, ax = plt.subplots(figsize=(10, 4.8), layout="constrained")
    fig.set_facecolor("#ffffff")
    positions = list(range(len(labels)))
    ax.barh(positions, means, height=0.55, color=colors, zorder=2)
    sampled = [(y, mean, values) for y, mean, values in zip(positions, means, samples) if len(values) > 1]
    ax.errorbar(
        [mean for _, mean, _ in sampled],
        [y for y, _, _ in sampled],
        xerr=[
            [mean - min(values) for _, mean, values in sampled],
            [max(values) - mean for _, mean, values in sampled],
        ],
        fmt="none",
        ecolor="#263445",
        capsize=4,
        linewidth=1.3,
        zorder=3,
    )
    for y, mean, values in zip(positions, means, samples):
        ax.text(max(values) + 5, y, f"{mean:.1f} ms", va="center", fontsize=10, color="#263445")
    ax.set_yticks(positions, labels)
    ax.invert_yaxis()
    ax.set_xlim(0, max(max(values) for values in samples) * 1.3)
    ax.set_xlabel("Milliseconds (mean; whiskers show observed minimum and maximum)")
    ax.set_title(title, loc="left", pad=20, weight="bold", fontsize=14)
    ax.grid(axis="x", color="#e5e9ee", zorder=0)
    ax.set_axisbelow(True)
    for edge in ["top", "right", "left"]:
        ax.spines[edge].set_visible(False)
    ax.spines["bottom"].set_color("#cbd3dc")
    ax.tick_params(axis="y", length=0, pad=10)
    fig.get_layout_engine().set(rect=(0, 0.17, 1, 0.83))
    fig.text(0.02, 0.035, footnote, fontsize=9, color="#4b5868", va="bottom")
    fig.savefig(ROOT / filename, dpi=160, metadata={"Software": "Matplotlib"})
    plt.close(fig)


samples = DATA["samplesMs"]
scheduler = DATA["scheduledChain"]
chart(
    "operation-timings.png",
    "Local seed: account creation is the expensive operation",
    ["Empty mutation", "Password hash only", "Full linked account creation", "Scheduled step + progress write"],
    [samples["noopMs"], samples["hashMs"], samples["createMs"], [scheduler["elapsedMs"] / scheduler["steps"]]],
    ["#8c9eb5", "#4285d4", "#174f93", "#8c9eb5"],
    "12 samples per mutation after 2 warmups; one 25-step scheduled chain.\nFull account creation includes hashing. The bars overlap in scope and must not be added.",
)
chart(
    "hash-runtime-timings.png",
    "Hashing remains costly in both measured environments",
    ["Convex mutation, including dispatch/commit", "Host Node.js, hash call only"],
    [samples["hashMs"], DATA["hostHash"]["samplesMs"]],
    ["#4285d4", "#6f8e56"],
    "12 warmed samples per environment, using Better Auth's hashPassword API.\nDifferent timing boundaries and input strings; this is not a measured application speedup.",
)
