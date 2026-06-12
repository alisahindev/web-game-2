import {
  allCells,
  cellKey,
  cloneBoard,
  getCell,
  occupiedNeighbors,
  removeCell,
  setCell,
  validNeighbors,
} from "./board";
import { calloutForResolution, scoreResolution } from "./scoring";
import type { Board, Coord, CrystalCell, ObstacleKind, ResolutionEvent } from "./types";

const isMatchable = (cell: CrystalCell): boolean => cell.obstacle !== "rock" && cell.obstacle !== "fossil" && cell.obstacle !== "lava-bubble";

const isDropAnchored = (cell: CrystalCell): boolean => cell.row === 0 || cell.obstacle === "chain";

const damageObstacle = (cell: CrystalCell): CrystalCell => {
  const durability = Math.max(0, (cell.durability ?? 1) - 1);
  const next = { ...cell, durability };

  if (durability > 0) return next;

  if (cell.obstacle === "ice-shell") {
    const { obstacle: _obstacle, durability: _durability, ...unwrapped } = next;
    return unwrapped;
  }

  return next;
};

export const findColorCluster = (board: Board, start: Coord): CrystalCell[] => {
  const startCell = getCell(board, start);
  if (!startCell || !isMatchable(startCell)) return [];

  const visited = new Set<string>();
  const queue: Coord[] = [start];
  const cluster: CrystalCell[] = [];

  while (queue.length > 0) {
    const coord = queue.shift();
    if (!coord) break;

    const key = cellKey(coord);
    if (visited.has(key)) continue;
    visited.add(key);

    const cell = getCell(board, coord);
    if (!cell || !isMatchable(cell)) continue;
    if (cell.color !== startCell.color && cell.special !== "wild" && startCell.special !== "wild") continue;

    cluster.push(cell);
    for (const neighbor of validNeighbors(board, coord)) {
      if (!visited.has(cellKey(neighbor))) queue.push(neighbor);
    }
  }

  return cluster;
};

export const findDisconnectedCells = (board: Board): CrystalCell[] => {
  const anchored = new Set<string>();
  const queue: Coord[] = allCells(board)
    .filter((cell) => isDropAnchored(cell))
    .map((cell) => ({ row: cell.row, col: cell.col }));

  while (queue.length > 0) {
    const coord = queue.shift();
    if (!coord) break;

    const key = cellKey(coord);
    if (anchored.has(key)) continue;

    const cell = getCell(board, coord);
    if (!cell) continue;

    anchored.add(key);
    for (const neighbor of occupiedNeighbors(board, coord)) {
      if (!anchored.has(cellKey(neighbor))) {
        queue.push(neighbor);
      }
    }
  }

  return allCells(board).filter((cell) => !anchored.has(cellKey(cell)) && cell.obstacle !== "chain");
};

const addSpecialTargets = (board: Board, source: CrystalCell, targets: Map<string, CrystalCell>): void => {
  if (source.special === "blast" || source.special === "mega-bomb") {
    for (const neighbor of occupiedNeighbors(board, source)) {
      targets.set(cellKey(neighbor), neighbor);

      if (source.special === "mega-bomb") {
        for (const secondRing of occupiedNeighbors(board, neighbor)) {
          targets.set(cellKey(secondRing), secondRing);
        }
      }
    }
  }

  if (source.special === "lightning") {
    for (const cell of allCells(board)) {
      if (cell.color === source.color) targets.set(cellKey(cell), cell);
      if (targets.size >= 8) return;
    }
  }

  if (source.special === "drill") {
    for (const cell of allCells(board)) {
      if (cell.col === source.col || Math.abs(cell.row - source.row) <= 1) {
        targets.set(cellKey(cell), cell);
      }
    }
  }
};

export const resolvePlacement = (
  sourceBoard: Board,
  placedCell: CrystalCell,
  currentCombo: number,
): { board: Board; event: ResolutionEvent; combo: number } => {
  const board = cloneBoard(sourceBoard);

  if (getCell(board, placedCell)) {
    throw new Error(`Landing cell is occupied: row ${placedCell.row}, col ${placedCell.col}`);
  }

  setCell(board, placedCell);

  const cluster = findColorCluster(board, placedCell);
  const poppedTargets = new Map<string, CrystalCell>();

  if (cluster.length >= 3) {
    for (const cell of cluster) {
      poppedTargets.set(cellKey(cell), cell);
    }

    for (const cell of cluster) {
      addSpecialTargets(board, cell, poppedTargets);
    }
  }

  const popped = [...poppedTargets.values()];
  const damaged: CrystalCell[] = [];

  if (popped.length > 0) {
    const damageTargets = new Map<string, CrystalCell>();

    for (const cell of popped) {
      for (const neighbor of occupiedNeighbors(board, cell)) {
        if (neighbor.obstacle && neighbor.obstacle !== "chain") {
          damageTargets.set(cellKey(neighbor), neighbor);
        }
      }
    }

    for (const cell of popped) {
      removeCell(board, cell);
    }

    for (const target of damageTargets.values()) {
      const damagedTarget = damageObstacle(target);
      damaged.push(damagedTarget);

      if ((damagedTarget.durability ?? 0) <= 0 && damagedTarget.obstacle !== "ice-shell") {
        removeCell(board, target);
      } else {
        setCell(board, damagedTarget);
      }
    }
  }

  const dropped = popped.length > 0 ? findDisconnectedCells(board) : [];
  for (const cell of dropped) {
    removeCell(board, cell);
  }

  const nextCombo = popped.length > 0 || dropped.length > 0 ? currentCombo + 1 : 0;
  const scoreDelta = scoreResolution(popped.length, dropped.length, nextCombo);

  return {
    board,
    combo: nextCombo,
    event: {
      popped,
      dropped,
      damaged,
      placed: placedCell,
      scoreDelta,
      callout: calloutForResolution(popped.length, dropped.length),
      source: "shot",
    },
  };
};

export const countBrokenObstacles = (damaged: CrystalCell[], obstacle: ObstacleKind): number =>
  damaged.filter((cell) => cell.obstacle === obstacle && (cell.durability ?? 0) <= 0).length;

export const resolveRemoval = (
  sourceBoard: Board,
  targets: Coord[],
  currentCombo: number,
): { board: Board; event: ResolutionEvent; combo: number } => {
  const board = cloneBoard(sourceBoard);
  const popped: CrystalCell[] = [];
  const seen = new Set<string>();

  for (const target of targets) {
    const key = cellKey(target);
    if (seen.has(key)) continue;
    seen.add(key);

    const removed = removeCell(board, target);
    if (removed) popped.push(removed);
  }

  const dropped = popped.length > 0 ? findDisconnectedCells(board) : [];
  for (const cell of dropped) {
    removeCell(board, cell);
  }

  const nextCombo = popped.length > 0 || dropped.length > 0 ? currentCombo + 1 : 0;
  const scoreDelta = scoreResolution(popped.length, dropped.length, nextCombo);

  return {
    board,
    combo: nextCombo,
    event: {
      popped,
      dropped,
      damaged: [],
      scoreDelta,
      callout: calloutForResolution(popped.length, dropped.length),
      source: "booster",
    },
  };
};
