import { describe, expect, it } from "vitest";
import { createBoard } from "./board";
import { resolvePlacement } from "./resolution";

describe("resolvePlacement", () => {
  it("pops a same-color cluster of three", () => {
    const board = createBoard(6, 6, [
      { row: 0, col: 0, color: "amber" },
      { row: 0, col: 1, color: "amber" },
    ]);

    const result = resolvePlacement(board, { row: 1, col: 0, color: "amber" }, 0);

    expect(result.event.popped).toHaveLength(3);
    expect(result.board.cells.size).toBe(0);
    expect(result.event.scoreDelta).toBeGreaterThan(0);
  });

  it("drops disconnected crystals after a connector pop", () => {
    const board = createBoard(6, 6, [
      { row: 0, col: 1, color: "lava" },
      { row: 1, col: 1, color: "lava" },
      { row: 2, col: 1, color: "ice" },
      { row: 3, col: 1, color: "ice" },
    ]);

    const result = resolvePlacement(board, { row: 1, col: 2, color: "lava" }, 0);

    expect(result.event.popped).toHaveLength(3);
    expect(result.event.dropped).toHaveLength(2);
    expect(result.board.cells.size).toBe(0);
  });

  it("damages adjacent rock when a cluster pops", () => {
    const board = createBoard(6, 6, [
      { row: 0, col: 0, color: "moss" },
      { row: 0, col: 1, color: "moss" },
      { row: 1, col: 1, color: "moon", obstacle: "rock", durability: 1 },
    ]);

    const result = resolvePlacement(board, { row: 1, col: 0, color: "moss" }, 0);

    expect(result.event.popped).toHaveLength(3);
    expect(result.event.damaged).toHaveLength(1);
    expect([...result.board.cells.values()].some((cell) => cell.obstacle === "rock")).toBe(false);
  });

  it("activates blast special crystals when popped", () => {
    const board = createBoard(6, 6, [
      { row: 0, col: 0, color: "lava" },
      { row: 0, col: 1, color: "lava", special: "blast" },
      { row: 1, col: 1, color: "ice" },
    ]);

    const result = resolvePlacement(board, { row: 1, col: 0, color: "lava" }, 0);

    expect(result.event.popped.some((cell) => cell.color === "ice")).toBe(true);
    expect(result.board.cells.size).toBe(0);
  });

  it("uses wild crystals as a match bridge", () => {
    const board = createBoard(6, 6, [
      { row: 0, col: 0, color: "amber" },
      { row: 0, col: 1, color: "spark", special: "wild" },
    ]);

    const result = resolvePlacement(board, { row: 1, col: 0, color: "amber" }, 0);

    expect(result.event.popped).toHaveLength(3);
  });

  it("activates drill special crystals when popped", () => {
    const board = createBoard(6, 6, [
      { row: 0, col: 0, color: "moon", special: "drill" },
      { row: 0, col: 1, color: "moon" },
      { row: 2, col: 0, color: "ice" },
      { row: 4, col: 0, color: "lava" },
    ]);

    const result = resolvePlacement(board, { row: 1, col: 0, color: "moon" }, 0);

    expect(result.event.popped.some((cell) => cell.row === 4 && cell.col === 0)).toBe(true);
  });
});
