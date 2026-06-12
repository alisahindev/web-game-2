import { describe, expect, it } from "vitest";
import { createBoard } from "./board";
import { traceAim, type BoardLayout } from "./geometry";

describe("traceAim", () => {
  it("returns a playable landing cell", () => {
    const board = createBoard(8, 6, [
      { row: 0, col: 2, color: "amber" },
      { row: 1, col: 2, color: "amber" },
    ]);
    const layout: BoardLayout = {
      radius: 20,
      originX: 0,
      originY: 0,
      width: 260,
      height: 520,
    };

    const trace = traceAim(board, -Math.PI / 2, layout, { x: 130, y: 480 });

    expect(trace.path.length).toBeGreaterThanOrEqual(2);
    expect(trace.landing.row).toBeGreaterThanOrEqual(0);
    expect(trace.landing.col).toBeGreaterThanOrEqual(0);
  });

  it("keeps bounced shots inside the board walls", () => {
    const board = createBoard(8, 6, [{ row: 0, col: 2, color: "amber" }]);
    const layout: BoardLayout = {
      radius: 20,
      originX: 30,
      originY: 0,
      width: 260,
      height: 520,
    };

    const trace = traceAim(board, (-160 * Math.PI) / 180, layout, { x: 160, y: 480 });
    const leftWall = layout.originX + layout.radius;
    const rightWall = layout.originX + layout.width - layout.radius;

    expect(trace.path.every((point) => point.x >= leftWall - 0.1 && point.x <= rightWall + 0.1)).toBe(true);
  });
});
