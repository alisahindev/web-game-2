export const crystalColors = ["amber", "lava", "ice", "moss", "moon", "spark"] as const;

export type CrystalColor = (typeof crystalColors)[number];

export type ObstacleKind = "rock" | "ice-shell" | "chain" | "fossil" | "lava-bubble";

export const boosterKinds = ["hammer", "color-shift", "extra-shots", "cave-bomb", "long-aim"] as const;

export type BoosterKind = (typeof boosterKinds)[number];

export type BoosterInventory = Record<BoosterKind, number>;

export type SpecialCrystalKind = "blast" | "lightning" | "drill" | "wild" | "mega-bomb";

export type Objective =
  | { kind: "clear"; amount: number }
  | { kind: "pop-color"; color: CrystalColor; amount: number }
  | { kind: "break-obstacle"; obstacle: ObstacleKind; amount: number }
  | { kind: "drop"; amount: number }
  | { kind: "score"; amount: number };

export type Level = {
  id: number;
  name: string;
  rows: number;
  cols: number;
  shots: number;
  colors: CrystalColor[];
  objectives: Objective[];
  layout: string[];
};

export type Coord = {
  row: number;
  col: number;
};

export type CrystalCell = Coord & {
  color: CrystalColor;
  obstacle?: ObstacleKind;
  durability?: number;
  special?: SpecialCrystalKind;
};

export type Board = {
  rows: number;
  cols: number;
  cells: Map<string, CrystalCell>;
};

export type GoalProgress = {
  popped: number;
  dropped: number;
  score: number;
  colorPops: Partial<Record<CrystalColor, number>>;
  obstacleBreaks: Partial<Record<ObstacleKind, number>>;
};

export type LauncherState = {
  current: CrystalColor;
  reserve: CrystalColor;
};

export type GameStatus = "playing" | "won" | "lost";

export type ResolutionEvent = {
  popped: CrystalCell[];
  dropped: CrystalCell[];
  damaged: CrystalCell[];
  placed?: CrystalCell;
  scoreDelta: number;
  callout?: string;
  source: "shot" | "booster";
};

export type GameState = {
  level: Level;
  board: Board;
  launcher: LauncherState;
  shotsRemaining: number;
  score: number;
  progress: GoalProgress;
  status: GameStatus;
  combo: number;
  seed: number;
  boosters: BoosterInventory;
  aimAssistShots: number;
  lastEvent?: ResolutionEvent;
};

export type AimPoint = {
  x: number;
  y: number;
};

export type AimTrace = {
  path: AimPoint[];
  landing: Coord;
};
