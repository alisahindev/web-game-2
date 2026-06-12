export type RngResult<T> = {
  value: T;
  seed: number;
};

export const nextSeed = (seed: number): number => {
  let value = seed + 0x6d2b79f5;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return (value ^ (value >>> 14)) >>> 0;
};

export const pick = <T>(items: readonly T[], seed: number): RngResult<T> => {
  if (items.length === 0) {
    throw new Error("Cannot pick from an empty list");
  }

  const next = nextSeed(seed);
  return {
    value: items[next % items.length],
    seed: next,
  };
};
