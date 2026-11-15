import matplotlib.pyplot as plt
import pandas as pd


def plot_winrates(wr: pd.DataFrame, ax=None):
    ax = ax or plt.gca()
    err = [wr.winrate - wr.ci_low, wr.ci_high - wr.winrate]
    ax.bar(wr.index, wr.winrate * 100, yerr=[e * 100 for e in err])
    ax.axhline(100 / len(wr), ls="--")  # fair share
    ax.set_ylabel("Win rate (%)")
    return ax
