import { describe, expect, it } from "vitest";
import { allCells } from "./board";
import { boardFromLevel, levels } from "./levels";
import { findColorCluster } from "./resolution";

const largestClusterSize = (levelIndex: number): number => {
  const board = boardFromLevel(levels[levelIndex]);
  return Math.max(...allCells(board).map((cell) => findColorCluster(board, cell).length));
};

describe("levels", () => {
  it("provides the first 50 playable levels", () => {
    expect(levels).toHaveLength(50);
    expect(levels.every((level) => level.layout.length === level.rows)).toBe(true);
    expect(levels.every((level) => level.layout.every((row) => row.length === level.cols))).toBe(true);
    expect(levels.every((level) => level.objectives.length > 0)).toBe(true);
  });

  it("keeps the first level forgiving enough for onboarding", () => {
    const firstLevel = levels[0];
    const objective = firstLevel.objectives[0];
    const board = boardFromLevel(firstLevel);

    expect(firstLevel.colors).toHaveLength(3);
    expect(firstLevel.shots).toBeGreaterThanOrEqual(board.cells.size);
    expect(objective.kind).toBe("clear");
    if (objective.kind !== "clear") throw new Error("Expected a clear objective");

    expect(objective.amount).toBe(0);
    expect(largestClusterSize(0)).toBeGreaterThanOrEqual(6);
  });

  it("ramps early color pressure gradually", () => {
    expect(levels.every((level) => level.objectives[0]?.kind === "clear")).toBe(true);
    expect(
      levels.every((level) => {
        const board = boardFromLevel(level);
        return level.shots >= Math.ceil(board.cells.size * 0.55);
      }),
    ).toBe(true);
    expect(levels.slice(0, 3).every((level) => level.colors.length === 3)).toBe(true);
    expect(levels.slice(3, 10).every((level) => level.colors.length === 4)).toBe(true);
    expect(levels.slice(0, 5).every((_, index) => largestClusterSize(index) >= 5)).toBe(true);
  });
});
