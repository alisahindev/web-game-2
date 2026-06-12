import { describe, expect, it } from "vitest";
import { pathLength, pointAtDistance } from "./path";

describe("path helpers", () => {
  it("samples a projectile position along a polyline", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 40 },
    ];

    expect(pathLength(path)).toBe(70);
    expect(pointAtDistance(path, 45)).toEqual({ x: 30, y: 15 });
  });
});
