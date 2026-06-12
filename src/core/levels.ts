import { createBoard } from "./board";
import type { Board, CrystalCell, CrystalColor, Level, Objective, ObstacleKind } from "./types";

const colorMap: Record<string, CrystalColor> = {
  A: "amber",
  L: "lava",
  B: "ice",
  M: "moss",
  O: "moon",
  S: "spark",
};

const obstacleMap: Record<string, { color: CrystalColor; obstacle: ObstacleKind; durability: number }> = {
  R: { color: "moon", obstacle: "rock", durability: 2 },
  F: { color: "amber", obstacle: "fossil", durability: 3 },
  C: { color: "moss", obstacle: "chain", durability: 1 },
  I: { color: "ice", obstacle: "ice-shell", durability: 1 },
  V: { color: "lava", obstacle: "lava-bubble", durability: 1 },
};

const specialMap: Record<string, Pick<CrystalCell, "color" | "special">> = {
  X: { color: "lava", special: "blast" },
  T: { color: "spark", special: "lightning" },
  D: { color: "moon", special: "drill" },
  W: { color: "spark", special: "wild" },
  G: { color: "amber", special: "mega-bomb" },
};

const colorSymbols = ["A", "L", "B", "M", "O", "S"] as const;

const earlyLayouts: Record<number, string[]> = {
  1: [
    "AAALLLAA",
    "AAALLLBB",
    ".AABBBL.",
    "..BBBB..",
    "........",
    "........",
    "........",
    "........",
    "........",
    "........",
    "........",
  ],
  2: [
    "AAALLLBB",
    "AALLLLBB",
    ".AABBBL.",
    ".AA.BBL.",
    "..BBB...",
    "........",
    "........",
    "........",
    "........",
    "........",
    "........",
  ],
  3: [
    "AALLLBBB",
    "AALLLBBB",
    ".AABBBL.",
    ".LL.BBA.",
    "..LLBB..",
    "........",
    "........",
    "........",
    "........",
    "........",
    "........",
  ],
  4: [
    "AAALLLMM",
    "AALLBBMM",
    ".AABBBM.",
    ".LL.BBM.",
    "..LLMM..",
    "........",
    "........",
    "........",
    "........",
    "........",
    "........",
  ],
  5: [
    "AALLMMBB",
    "AALLMMBB",
    ".AABBLM.",
    ".LL.BBM.",
    "..LLMM..",
    "........",
    "........",
    "........",
    "........",
    "........",
    "........",
  ],
};

const levelNames = [
  "İlk Kıvılcım",
  "Sekme Yolu",
  "Kaya Yanığı",
  "Buz Kabuğu",
  "Kristal Yağmuru",
  "Dar Geçit",
  "Fosil Ağzı",
  "Zincir Tavan",
  "Lav Nefesi",
  "Bölüm Kapısı",
];

const colorsForLevel = (id: number): CrystalColor[] => {
  if (id <= 3) return ["amber", "lava", "ice"];
  if (id <= 12) return ["amber", "lava", "ice", "moss"];
  if (id <= 25) return ["amber", "lava", "ice", "moss", "moon"];
  return ["amber", "lava", "ice", "moss", "moon", "spark"];
};

const symbolFor = (row: number, col: number, id: number, colors: CrystalColor[]): string => {
  if (row === 0) return colorSymbols[(Math.floor(col / 2) + id) % colors.length];

  if (id >= 16 && (row + col + id) % 17 === 0) return "R";
  if (id >= 21 && (row * 2 + col + id) % 19 === 0) return "I";
  if (id >= 31 && row <= 2 && (col + id) % 5 === 0) return "C";
  if (id >= 36 && (row + col * 3 + id) % 23 === 0) return "F";
  if (id >= 41 && (row * 2 + col * 5 + id) % 27 === 0) return "V";
  if (id >= 26 && (row * 5 + col + id) % 29 === 0) return "X";
  if (id >= 30 && (row * 3 + col * 2 + id) % 31 === 0) return "T";
  if (id >= 33 && (row * 11 + col + id) % 41 === 0) return "D";
  if (id >= 28 && (row + col * 7 + id) % 43 === 0) return "W";
  if (id >= 46 && (row + col + id) % 37 === 0) return "G";

  return colorSymbols[(Math.floor(row / 2) + Math.floor(col / 2) + id) % colors.length];
};

const generatedLayout = (id: number, colors: CrystalColor[]): string[] => {
  const earlyLayout = earlyLayouts[id];
  if (earlyLayout) return earlyLayout;

  const rows = 11;
  const cols = 8;
  const filledRows = Math.min(8, 4 + Math.floor((id - 1) / 7));
  const layout: string[] = [];

  for (let row = 0; row < rows; row += 1) {
    let line = "";

    for (let col = 0; col < cols; col += 1) {
      if (row >= filledRows) {
        line += ".";
        continue;
      }

      const isGap = row > 0 && row < filledRows - 1 && (row * 7 + col * 5 + id) % (id < 8 ? 13 : 9) === 0;
      line += isGap ? "." : symbolFor(row, col, id, colors);
    }

    layout.push(line);
  }

  return layout;
};

const objectivesForLevel = (): Objective[] => [{ kind: "clear", amount: 0 }];

const filledCellCount = (layout: string[]): number =>
  layout.reduce((total, line) => total + [...line].filter((symbol) => symbol !== ".").length, 0);

const shotsForLevel = (id: number, layout: string[]): number => {
  const earlyShots = [38, 37, 36, 35, 35][id - 1];
  if (earlyShots !== undefined) return earlyShots;

  const cells = filledCellCount(layout);
  if (id <= 10) return Math.ceil(cells * 0.9) + 8;
  if (id <= 20) return Math.ceil(cells * 0.75) + 8;
  if (id <= 30) return Math.ceil(cells * 0.62) + 9;
  if (id <= 40) return Math.ceil(cells * 0.58) + 10;
  return Math.ceil(cells * 0.6) + 12;
};

const makeLevel = (id: number): Level => {
  const colors = colorsForLevel(id);
  const layout = generatedLayout(id, colors);

  return {
    id,
    name: levelNames[(id - 1) % levelNames.length],
    rows: 11,
    cols: 8,
    shots: shotsForLevel(id, layout),
    colors,
    objectives: objectivesForLevel(),
    layout,
  };
};

export const levels: Level[] = Array.from({ length: 50 }, (_, index) => makeLevel(index + 1));

export const boardFromLevel = (level: Level): Board => {
  const cells: CrystalCell[] = [];

  level.layout.forEach((line, row) => {
    [...line].forEach((symbol, col) => {
      if (symbol === ".") return;

      const obstacle = obstacleMap[symbol];
      if (obstacle) {
        cells.push({ row, col, ...obstacle });
        return;
      }

      const special = specialMap[symbol];
      if (special) {
        cells.push({ row, col, ...special });
        return;
      }

      const color = colorMap[symbol];
      if (!color) {
        throw new Error(`Unknown level symbol "${symbol}" in level ${level.id}`);
      }
      cells.push({ row, col, color });
    });
  });

  return createBoard(level.rows, level.cols, cells);
};
