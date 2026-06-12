import { allCells, cloneBoard, emptyNeighbors, occupiedNeighbors, setCell } from "./board";
import { boardFromLevel, levels } from "./levels";
import { pick } from "./rng";
import { countBrokenObstacles, resolvePlacement, resolveRemoval } from "./resolution";
import type { Board, BoosterInventory, BoosterKind, Coord, CrystalCell, CrystalColor, GameState, GoalProgress, Level, Objective, ObstacleKind } from "./types";

const initialProgress = (): GoalProgress => ({
  popped: 0,
  dropped: 0,
  score: 0,
  colorPops: {},
  obstacleBreaks: {},
});

const initialBoosters = (): BoosterInventory => ({
  hammer: 2,
  "color-shift": 2,
  "extra-shots": 1,
  "cave-bomb": 1,
  "long-aim": 1,
});

const addColorPops = (
  source: Partial<Record<CrystalColor, number>>,
  cells: CrystalCell[],
): Partial<Record<CrystalColor, number>> => {
  const next = { ...source };
  for (const cell of cells) {
    next[cell.color] = (next[cell.color] ?? 0) + 1;
  }
  return next;
};

const objectiveComplete = (state: GameState, objective: Objective): boolean => {
  switch (objective.kind) {
    case "clear":
      return state.board.cells.size <= objective.amount;
    case "pop-color":
      return (state.progress.colorPops[objective.color] ?? 0) >= objective.amount;
    case "break-obstacle":
      return (state.progress.obstacleBreaks[objective.obstacle] ?? 0) >= objective.amount;
    case "drop":
      return state.progress.dropped >= objective.amount;
    case "score":
      return state.score >= objective.amount;
  }
};

const allObjectivesComplete = (state: GameState): boolean => state.level.objectives.every((objective) => objectiveComplete(state, objective));

const drawColor = (colors: CrystalColor[], seed: number): { color: CrystalColor; seed: number } => {
  const result = pick(colors, seed);
  return { color: result.value, seed: result.seed };
};

const isUsefulShotTarget = (cell: CrystalCell): boolean =>
  cell.obstacle !== "rock" && cell.obstacle !== "fossil" && cell.obstacle !== "lava-bubble";

const shotColorsForBoard = (board: Board, levelColors: CrystalColor[]): CrystalColor[] => {
  const activeColors = new Set(allCells(board).filter(isUsefulShotTarget).map((cell) => cell.color));
  const usefulColors = levelColors.filter((color) => activeColors.has(color));
  return usefulColors.length > 0 ? usefulColors : levelColors;
};

const nextColorInLevel = (colors: CrystalColor[], current: CrystalColor): CrystalColor => {
  const index = colors.indexOf(current);
  if (index < 0) return colors[0];
  return colors[(index + 1) % colors.length];
};

const decrementBooster = (boosters: BoosterInventory, booster: BoosterKind): BoosterInventory => ({
  ...boosters,
  [booster]: Math.max(0, boosters[booster] - 1),
});

const countRemovedObstacles = (cells: CrystalCell[], objective: Objective): number => {
  if (objective.kind !== "break-obstacle") return 0;
  return cells.filter((cell) => cell.obstacle === objective.obstacle).length;
};

const addObstacleBreaks = (state: GameState, cells: CrystalCell[], damaged: CrystalCell[]): Partial<Record<ObstacleKind, number>> => {
  const obstacleBreaks = { ...state.progress.obstacleBreaks };

  for (const objective of state.level.objectives) {
    if (objective.kind !== "break-obstacle") continue;

    const broken = countBrokenObstacles(damaged, objective.obstacle) + countRemovedObstacles(cells, objective);
    if (broken > 0) {
      obstacleBreaks[objective.obstacle] = (obstacleBreaks[objective.obstacle] ?? 0) + broken;
    }
  }

  return obstacleBreaks;
};

const spreadLavaBubbles = (sourceBoard: Board, seed: number): { board: Board; seed: number } => {
  const board = cloneBoard(sourceBoard);
  let nextSeed = seed;
  let spreads = 0;

  for (const bubble of allCells(sourceBoard).filter((cell) => cell.obstacle === "lava-bubble")) {
    if (spreads >= 2) break;

    const candidates = emptyNeighbors(board, bubble);
    if (candidates.length === 0) continue;

    const picked = pick(candidates, nextSeed);
    nextSeed = picked.seed;
    setCell(board, {
      ...picked.value,
      color: "lava",
      obstacle: "lava-bubble",
      durability: 1,
    });
    spreads += 1;
  }

  return { board, seed: nextSeed };
};

const settleState = (state: GameState): GameState => {
  if (allObjectivesComplete(state)) {
    return { ...state, status: "won" };
  }

  if (state.shotsRemaining <= 0) {
    return { ...state, status: "lost" };
  }

  return state;
};

export const createGame = (level: Level = levels[0], seed = 104729): GameState => {
  const board = boardFromLevel(level);
  const shotColors = shotColorsForBoard(board, level.colors);
  const current = drawColor(shotColors, seed);
  const reserve = drawColor(shotColors, current.seed);

  return {
    level,
    board,
    launcher: {
      current: current.color,
      reserve: reserve.color,
    },
    shotsRemaining: level.shots,
    score: 0,
    progress: initialProgress(),
    status: "playing",
    combo: 0,
    seed: reserve.seed,
    boosters: initialBoosters(),
    aimAssistShots: 0,
  };
};

export const remainingForObjective = (state: GameState, objective: Objective): number => {
  switch (objective.kind) {
    case "clear":
      return Math.max(0, state.board.cells.size - objective.amount);
    case "pop-color":
      return Math.max(0, objective.amount - (state.progress.colorPops[objective.color] ?? 0));
    case "break-obstacle":
      return Math.max(0, objective.amount - (state.progress.obstacleBreaks[objective.obstacle] ?? 0));
    case "drop":
      return Math.max(0, objective.amount - state.progress.dropped);
    case "score":
      return Math.max(0, objective.amount - state.score);
  }
};

export const applyShot = (state: GameState, landing: Coord): GameState => {
  if (state.status !== "playing") return state;
  if (state.shotsRemaining <= 0) {
    return { ...state, status: "lost" };
  }

  const placed: CrystalCell = {
    ...landing,
    color: state.launcher.current,
  };

  const resolved = resolvePlacement(state.board, placed, state.combo);
  const shouldSpreadLava = state.level.id >= 41 && (state.shotsRemaining - 1) % 3 === 0;
  const spread = shouldSpreadLava ? spreadLavaBubbles(resolved.board, state.seed) : { board: resolved.board, seed: state.seed };
  const nextColor = drawColor(shotColorsForBoard(spread.board, state.level.colors), spread.seed);
  const obstacleBreaks = addObstacleBreaks(state, resolved.event.popped, resolved.event.damaged);

  const nextProgress: GoalProgress = {
    popped: state.progress.popped + resolved.event.popped.length,
    dropped: state.progress.dropped + resolved.event.dropped.length,
    score: state.progress.score + resolved.event.scoreDelta,
    colorPops: addColorPops(state.progress.colorPops, resolved.event.popped),
    obstacleBreaks,
  };

  const nextState: GameState = {
    ...state,
    board: spread.board,
    launcher: {
      current: state.launcher.reserve,
      reserve: nextColor.color,
    },
    shotsRemaining: state.shotsRemaining - 1,
    score: state.score + resolved.event.scoreDelta,
    progress: nextProgress,
    combo: resolved.combo,
    seed: nextColor.seed,
    aimAssistShots: Math.max(0, state.aimAssistShots - 1),
    lastEvent: resolved.event,
  };

  return settleState(nextState);
};

export const applyBooster = (state: GameState, booster: BoosterKind, target?: Coord): GameState => {
  if (state.status !== "playing" || state.boosters[booster] <= 0) return state;

  if (booster === "extra-shots") {
    return {
      ...state,
      boosters: decrementBooster(state.boosters, booster),
      shotsRemaining: state.shotsRemaining + 5,
      lastEvent: undefined,
    };
  }

  if (booster === "color-shift") {
    return {
      ...state,
      boosters: decrementBooster(state.boosters, booster),
      launcher: {
        ...state.launcher,
        current: nextColorInLevel(state.level.colors, state.launcher.current),
      },
      lastEvent: undefined,
    };
  }

  if (booster === "long-aim") {
    return {
      ...state,
      boosters: decrementBooster(state.boosters, booster),
      aimAssistShots: Math.max(state.aimAssistShots, 3),
      lastEvent: undefined,
    };
  }

  if (!target) return state;

  const targets = booster === "cave-bomb" ? [target, ...occupiedNeighbors(state.board, target)] : [target];
  const resolved = resolveRemoval(state.board, targets, state.combo);
  if (resolved.event.popped.length === 0) return state;

  const nextProgress: GoalProgress = {
    popped: state.progress.popped + resolved.event.popped.length,
    dropped: state.progress.dropped + resolved.event.dropped.length,
    score: state.progress.score + resolved.event.scoreDelta,
    colorPops: addColorPops(state.progress.colorPops, resolved.event.popped),
    obstacleBreaks: addObstacleBreaks(state, resolved.event.popped, resolved.event.damaged),
  };

  return settleState({
    ...state,
    board: resolved.board,
    boosters: decrementBooster(state.boosters, booster),
    score: state.score + resolved.event.scoreDelta,
    progress: nextProgress,
    combo: resolved.combo,
    lastEvent: resolved.event,
  });
};

export const swapLauncher = (state: GameState): GameState => {
  if (state.status !== "playing") return state;
  return {
    ...state,
    launcher: {
      current: state.launcher.reserve,
      reserve: state.launcher.current,
    },
  };
};

export const restartGame = (state: GameState): GameState => createGame(state.level, state.seed);
