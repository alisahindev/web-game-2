import { describe, expect, it } from "vitest";
import { applyBooster, applyShot, createGame, swapLauncher } from "./engine";
import { levels } from "./levels";
import type { Level } from "./types";

describe("engine", () => {
  it("advances launcher and consumes one shot", () => {
    const game = createGame(levels[0], 7);
    const next = applyShot(game, { row: 5, col: 0 });

    expect(next.shotsRemaining).toBe(game.shotsRemaining - 1);
    expect(next.launcher.current).toBe(game.launcher.reserve);
    expect(next.seed).not.toBe(game.seed);
    expect(next.status).toBe("playing");
  });

  it("swaps current and reserve crystal", () => {
    const game = createGame(levels[0], 11);
    const swapped = swapLauncher(game);

    expect(swapped.launcher.current).toBe(game.launcher.reserve);
    expect(swapped.launcher.reserve).toBe(game.launcher.current);
  });

  it("uses immediate boosters without consuming a shot", () => {
    const game = createGame(levels[0], 13);
    const boosted = applyBooster(game, "extra-shots");

    expect(boosted.shotsRemaining).toBe(game.shotsRemaining + 5);
    expect(boosted.boosters["extra-shots"]).toBe(game.boosters["extra-shots"] - 1);
  });

  it("starts with useful launcher colors from the current board", () => {
    const amberOnlyLevel: Level = {
      id: 999,
      name: "Amber Check",
      rows: 3,
      cols: 3,
      shots: 10,
      colors: ["amber", "lava", "ice"],
      objectives: [{ kind: "clear", amount: 0 }],
      layout: ["AAA", "...", "..."],
    };
    const game = createGame(amberOnlyLevel, 104729);

    expect(game.launcher.current).toBe("amber");
    expect(game.launcher.reserve).toBe("amber");
  });

  it("completes clear objectives only when the board is empty", () => {
    const clearLevel: Level = {
      id: 1000,
      name: "Clear Check",
      rows: 3,
      cols: 3,
      shots: 10,
      colors: ["amber"],
      objectives: [{ kind: "clear", amount: 0 }],
      layout: ["AAA", "...", "..."],
    };
    const game = createGame(clearLevel, 1);
    const next = applyShot(game, { row: 1, col: 0 });

    expect(next.board.cells.size).toBe(0);
    expect(next.status).toBe("won");
  });

  it("does not win with non-clear objectives while crystals remain", () => {
    const scoreLevel: Level = {
      id: 1001,
      name: "No Early Exit",
      rows: 3,
      cols: 3,
      shots: 10,
      colors: ["amber"],
      objectives: [{ kind: "score", amount: 0 }],
      layout: ["A..", "...", "..."],
    };
    const game = createGame(scoreLevel, 1);
    const next = applyShot(game, { row: 1, col: 0 });

    expect(next.board.cells.size).toBeGreaterThan(0);
    expect(next.status).toBe("playing");
  });

  it("uses cave bomb on a target and updates board state", () => {
    const game = createGame(levels[0], 17);
    const target = [...game.board.cells.values()][0];
    const boosted = applyBooster(game, "cave-bomb", target);

    expect(boosted.board.cells.size).toBeLessThan(game.board.cells.size);
    expect(boosted.boosters["cave-bomb"]).toBe(game.boosters["cave-bomb"] - 1);
  });

  it("spreads lava bubbles on later levels", () => {
    const level = levels.find((candidate) => candidate.id >= 41);
    expect(level).toBeDefined();
    if (!level) throw new Error("Expected late level");

    const game = createGame(level, 23);
    const before = [...game.board.cells.values()].filter((cell) => cell.obstacle === "lava-bubble").length;
    const next = applyShot({ ...game, shotsRemaining: 19 }, { row: 10, col: 0 });
    const after = [...next.board.cells.values()].filter((cell) => cell.obstacle === "lava-bubble").length;

    expect(after).toBeGreaterThanOrEqual(before);
  });
});
