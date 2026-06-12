import { describe, expect, it } from "vitest";
import { levels } from "./levels";

describe("levels", () => {
  it("provides the first 50 playable levels", () => {
    expect(levels).toHaveLength(50);
    expect(levels.every((level) => level.layout.length === level.rows)).toBe(true);
    expect(levels.every((level) => level.layout.every((row) => row.length === level.cols))).toBe(true);
    expect(levels.every((level) => level.objectives.length > 0)).toBe(true);
  });
});
