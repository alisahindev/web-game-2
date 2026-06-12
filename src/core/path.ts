import type { AimPoint } from "./types";

export const pathLength = (path: AimPoint[]): number =>
  path.slice(1).reduce((total, point, index) => {
    const previous = path[index];
    return total + Math.hypot(point.x - previous.x, point.y - previous.y);
  }, 0);

export const pointAtDistance = (path: AimPoint[], distance: number): AimPoint => {
  if (path.length === 0) {
    throw new Error("Cannot sample an empty path");
  }

  if (path.length === 1 || distance <= 0) {
    return { ...path[0] };
  }

  let remaining = distance;

  for (let index = 1; index < path.length; index += 1) {
    const start = path[index - 1];
    const end = path[index];
    const segmentLength = Math.hypot(end.x - start.x, end.y - start.y);

    if (remaining <= segmentLength) {
      const progress = segmentLength === 0 ? 1 : remaining / segmentLength;
      return {
        x: start.x + (end.x - start.x) * progress,
        y: start.y + (end.y - start.y) * progress,
      };
    }

    remaining -= segmentLength;
  }

  return { ...path[path.length - 1] };
};
