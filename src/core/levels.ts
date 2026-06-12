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

const objectivesForLevel = (id: number): Objective[] => {
  if (id <= 5) return [{ kind: "remove", amount: [12, 14, 16, 18, 20][id - 1] }];
  if (id <= 10) return [{ kind: "drop", amount: 5 + Math.floor(id / 2) }];
  if (id <= 15) return [{ kind: "pop-color", color: id % 2 === 0 ? "amber" : "ice", amount: 8 + id }];
  if (id <= 20) return [{ kind: "break-obstacle", obstacle: "rock", amount: 2 + Math.floor((id - 16) / 2) }];
  if (id <= 25) return [{ kind: "break-obstacle", obstacle: "ice-shell", amount: 2 + Math.floor((id - 21) / 2) }];
  if (id <= 30) return [{ kind: "score", amount: 700 + id * 35 }];
  if (id <= 35) return [{ kind: "drop", amount: 12 + Math.floor((id - 31) / 2) }];
  if (id <= 40) return [{ kind: "break-obstacle", obstacle: "fossil", amount: 1 + Math.floor((id - 36) / 2) }];
  if (id <= 45) return [{ kind: "score", amount: 1200 + id * 45 }];
  return [
    { kind: "drop", amount: 14 },
    { kind: "score", amount: 1800 + id * 50 },
  ];
};

const makeLevel = (id: number): Level => {
  const colors = colorsForLevel(id);
  const earlyShots = [30, 29, 28, 27, 26][id - 1];

  return {
    id,
    name: levelNames[(id - 1) % levelNames.length],
    rows: 11,
    cols: 8,
    shots: earlyShots ?? (id <= 10 ? 25 - Math.floor((id - 6) / 2) : Math.max(14, 22 - Math.floor(id / 5))),
    colors,
    objectives: objectivesForLevel(id),
    layout: generatedLayout(id, colors),
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
