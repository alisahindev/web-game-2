import { emptyNeighbors, getCell, hasCell, isInsideBoard, occupiedNeighbors } from "./board";
import type { AimPoint, AimTrace, Board, Coord } from "./types";

export type BoardLayout = {
  radius: number;
  originX: number;
  originY: number;
  width: number;
  height: number;
};

export const cellCenter = (coord: Coord, layout: BoardLayout): AimPoint => {
  const diameter = layout.radius * 2;
  const rowHeight = Math.sqrt(3) * layout.radius;
  const oddOffset = coord.row % 2 === 1 ? layout.radius : 0;

  return {
    x: layout.originX + layout.radius + oddOffset + coord.col * diameter,
    y: layout.originY + layout.radius + coord.row * rowHeight,
  };
};

export const coordFromPoint = (board: Board, point: AimPoint, layout: BoardLayout): Coord => {
  const rowHeight = Math.sqrt(3) * layout.radius;
  const roughRow = Math.round((point.y - layout.originY - layout.radius) / rowHeight);
  const oddOffset = roughRow % 2 === 1 ? layout.radius : 0;
  const roughCol = Math.round((point.x - layout.originX - layout.radius - oddOffset) / (layout.radius * 2));
  const coord = {
    row: Math.max(0, Math.min(board.rows - 1, roughRow)),
    col: Math.max(0, Math.min(board.cols - 1, roughCol)),
  };

  return coord;
};

export const closestEmptyToPoint = (board: Board, candidates: Coord[], point: AimPoint, layout: BoardLayout): Coord | undefined =>
  candidates
    .filter((coord) => isInsideBoard(board, coord) && !hasCell(board, coord))
    .map((coord) => {
      const center = cellCenter(coord, layout);
      const distance = Math.hypot(center.x - point.x, center.y - point.y);
      return { coord, distance };
    })
    .sort((a, b) => a.distance - b.distance)[0]?.coord;

const allEmptyCoords = (board: Board): Coord[] => {
  const coords: Coord[] = [];

  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      const coord = { row, col };
      if (!hasCell(board, coord)) coords.push(coord);
    }
  }

  return coords;
};

export const traceAim = (
  board: Board,
  angleRadians: number,
  layout: BoardLayout,
  shooter: AimPoint,
  maxSteps = 900,
): AimTrace => {
  const minAngle = (-165 * Math.PI) / 180;
  const maxAngle = (-15 * Math.PI) / 180;
  const angle = Math.max(minAngle, Math.min(maxAngle, angleRadians));
  const speed = layout.radius / 6;
  const collisionDistance = layout.radius * 1.62;
  const path: AimPoint[] = [{ ...shooter }];
  let position = { ...shooter };
  let velocity = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };

  for (let step = 0; step < maxSteps; step += 1) {
    position = {
      x: position.x + velocity.x,
      y: position.y + velocity.y,
    };

    const leftWall = layout.originX + layout.radius;
    const rightWall = layout.originX + layout.width - layout.radius;

    if (position.x < leftWall) {
      position.x = leftWall + (leftWall - position.x);
      velocity = { ...velocity, x: Math.abs(velocity.x) };
      path.push({ x: leftWall, y: position.y });
    } else if (position.x > rightWall) {
      position.x = rightWall - (position.x - rightWall);
      velocity = { ...velocity, x: -Math.abs(velocity.x) };
      path.push({ x: rightWall, y: position.y });
    }

    if (position.y <= layout.originY + layout.radius) {
      const topCoord = coordFromPoint(board, position, layout);
      const landing = hasCell(board, topCoord)
        ? closestEmptyToPoint(board, emptyNeighbors(board, topCoord), position, layout)
        : topCoord;

      if (landing) {
        path.push(cellCenter(landing, layout));
        return { path, landing };
      }
    }

    for (const cell of board.cells.values()) {
      const center = cellCenter(cell, layout);
      if (Math.hypot(center.x - position.x, center.y - position.y) <= collisionDistance) {
        const landing =
          closestEmptyToPoint(board, emptyNeighbors(board, cell), position, layout) ??
          closestEmptyToPoint(board, occupiedNeighbors(board, cell).flatMap((neighbor) => emptyNeighbors(board, neighbor)), position, layout);

        if (landing) {
          path.push(cellCenter(landing, layout));
          return { path, landing };
        }
      }
    }
  }

  const fallback = coordFromPoint(board, position, layout);
  if (!getCell(board, fallback)) {
    path.push(cellCenter(fallback, layout));
    return { path, landing: fallback };
  }

  const landing = closestEmptyToPoint(board, emptyNeighbors(board, fallback), position, layout) ?? closestEmptyToPoint(board, allEmptyCoords(board), position, layout) ?? { row: 0, col: 0 };
  path.push(cellCenter(landing, layout));
  return { path, landing };
};
