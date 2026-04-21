export type SymbolDemand = {
  symbol: string;
  watcherCount: number;
  lastIngestedAt: string | null;
};

export function rankSymbolsForPolling(
  symbols: SymbolDemand[],
  maxSymbolsPerRun: number,
  now = Date.now()
): SymbolDemand[] {
  return [...symbols]
    .sort((left, right) => {
      if (right.watcherCount !== left.watcherCount) {
        return right.watcherCount - left.watcherCount;
      }

      const leftAge = getAgeScore(left.lastIngestedAt, now);
      const rightAge = getAgeScore(right.lastIngestedAt, now);

      if (rightAge !== leftAge) {
        return rightAge - leftAge;
      }

      return left.symbol.localeCompare(right.symbol);
    })
    .slice(0, maxSymbolsPerRun);
}

function getAgeScore(lastIngestedAt: string | null, now: number): number {
  if (!lastIngestedAt) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Math.max(0, Math.floor((now - new Date(lastIngestedAt).getTime()) / 1000));
}

