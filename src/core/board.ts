import type { Board, Coord, CrystalCell } from "./types";

const EVEN_ROW_NEIGHBORS: Coord[] = [
  { row: -1, col: -1 },
  { row: -1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
  { row: 1, col: -1 },
  { row: 1, col: 0 },
];

const ODD_ROW_NEIGHBORS: Coord[] = [
  { row: -1, col: 0 },
  { row: -1, col: 1 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
  { row: 1, col: 0 },
  { row: 1, col: 1 },
];

export const cellKey = (coord: Coord): string => `${coord.row}:${coord.col}`;

export const isInsideBoard = (board: Pick<Board, "rows" | "cols">, coord: Coord): boolean =>
  coord.row >= 0 && coord.row < board.rows && coord.col >= 0 && coord.col < board.cols;

export const createBoard = (rows: number, cols: number, cells: CrystalCell[] = []): Board => {
  const board: Board = { rows, cols, cells: new Map() };

  for (const cell of cells) {
    if (!isInsideBoard(board, cell)) {
      throw new Error(`Cell out of board: row ${cell.row}, col ${cell.col}`);
    }
    board.cells.set(cellKey(cell), { ...cell });
  }

  return board;
};

export const cloneBoard = (board: Board): Board => ({
  rows: board.rows,
  cols: board.cols,
  cells: new Map([...board.cells].map(([key, cell]) => [key, { ...cell }])),
});

export const getCell = (board: Board, coord: Coord): CrystalCell | undefined => board.cells.get(cellKey(coord));

export const hasCell = (board: Board, coord: Coord): boolean => board.cells.has(cellKey(coord));

export const setCell = (board: Board, cell: CrystalCell): void => {
  if (!isInsideBoard(board, cell)) {
    throw new Error(`Cell out of board: row ${cell.row}, col ${cell.col}`);
  }
  board.cells.set(cellKey(cell), { ...cell });
};

export const removeCell = (board: Board, coord: Coord): CrystalCell | undefined => {
  const key = cellKey(coord);
  const cell = board.cells.get(key);
  board.cells.delete(key);
  return cell;
};

export const neighborCoords = (coord: Coord): Coord[] => {
  const offsets = coord.row % 2 === 0 ? EVEN_ROW_NEIGHBORS : ODD_ROW_NEIGHBORS;
  return offsets.map((offset) => ({ row: coord.row + offset.row, col: coord.col + offset.col }));
};

export const validNeighbors = (board: Board, coord: Coord): Coord[] =>
  neighborCoords(coord).filter((candidate) => isInsideBoard(board, candidate));

export const occupiedNeighbors = (board: Board, coord: Coord): CrystalCell[] =>
  validNeighbors(board, coord)
    .map((candidate) => getCell(board, candidate))
    .filter((cell): cell is CrystalCell => Boolean(cell));

export const emptyNeighbors = (board: Board, coord: Coord): Coord[] =>
  validNeighbors(board, coord).filter((candidate) => !hasCell(board, candidate));

export const allCells = (board: Board): CrystalCell[] => [...board.cells.values()].map((cell) => ({ ...cell }));
