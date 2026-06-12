import { cellCenter, type BoardLayout } from "../core/geometry";
import type { AimPoint, AimTrace, CrystalCell, CrystalColor, GameState } from "../core/types";
import { crystalStyle } from "./theme";

export type ProjectileRenderState = {
  color: CrystalColor;
  position: AimPoint;
};

export type EffectRenderState = {
  popped: CrystalCell[];
  dropped: CrystalCell[];
  damaged: CrystalCell[];
  progress: number;
};

const drawCrystal = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: keyof typeof crystalStyle,
  isProjectile = false,
  showSymbol = false,
): void => {
  const style = crystalStyle[color];
  const spikes = color === "spark" ? 7 : color === "ice" ? 6 : 8;

  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();

  for (let index = 0; index < spikes; index += 1) {
    const angle = (Math.PI * 2 * index) / spikes - Math.PI / 2;
    const pointRadius = radius * (index % 2 === 0 ? 1 : 0.78);
    const px = Math.cos(angle) * pointRadius;
    const py = Math.sin(angle) * pointRadius;
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }

  ctx.closePath();
  ctx.fillStyle = style.fill;
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = Math.max(2, radius * 0.12);
  ctx.shadowColor = isProjectile ? style.core : "rgba(0,0,0,.35)";
  ctx.shadowBlur = isProjectile ? radius * 0.8 : radius * 0.25;
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(-radius * 0.22, -radius * 0.25, radius * 0.28, radius * 0.18, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = style.core;
  ctx.globalAlpha = 0.78;
  ctx.fill();

  if (showSymbol) {
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = style.stroke;
    ctx.font = `900 ${Math.max(10, Math.round(radius * 0.72))}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(style.label.slice(0, 1).toUpperCase(), 0, radius * 0.08);
  }

  ctx.restore();
};

const shortenPath = (path: AimPoint[], fraction: number): AimPoint[] => {
  if (path.length <= 1 || fraction >= 1) return path;

  const total = path.slice(1).reduce((sum, point, index) => {
    const previous = path[index];
    return sum + Math.hypot(point.x - previous.x, point.y - previous.y);
  }, 0);
  const target = total * fraction;
  const shortened: AimPoint[] = [path[0]];
  let distance = 0;

  for (let index = 1; index < path.length; index += 1) {
    const start = path[index - 1];
    const end = path[index];
    const segment = Math.hypot(end.x - start.x, end.y - start.y);

    if (distance + segment >= target) {
      const local = segment === 0 ? 1 : (target - distance) / segment;
      shortened.push({
        x: start.x + (end.x - start.x) * local,
        y: start.y + (end.y - start.y) * local,
      });
      return shortened;
    }

    shortened.push(end);
    distance += segment;
  }

  return shortened;
};

const drawCaveBackground = (ctx: CanvasRenderingContext2D, width: number, height: number): void => {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#2b1831");
  gradient.addColorStop(0.45, "#3b2031");
  gradient.addColorStop(1, "#170f18");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(255, 190, 98, .08)";
  for (let index = 0; index < 16; index += 1) {
    const x = (index * 97) % width;
    const y = 28 + ((index * 61) % Math.max(1, height - 80));
    ctx.beginPath();
    ctx.arc(x, y, 3 + (index % 4), 0, Math.PI * 2);
    ctx.fill();
  }
};

const drawAim = (ctx: CanvasRenderingContext2D, trace: AimTrace | undefined, fullAim: boolean): void => {
  if (!trace) return;

  const path = shortenPath(trace.path, fullAim ? 1 : 0.62);
  ctx.save();
  ctx.setLineDash([8, 9]);
  ctx.lineWidth = 3;
  ctx.strokeStyle = fullAim ? "rgba(122, 229, 255, .95)" : "rgba(255, 224, 138, .9)";
  ctx.beginPath();
  path.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();
  ctx.restore();
};

const drawEffects = (ctx: CanvasRenderingContext2D, layout: BoardLayout, effects: EffectRenderState | undefined): void => {
  if (!effects) return;

  const progress = Math.max(0, Math.min(1, effects.progress));
  ctx.save();

  for (const cell of effects.popped) {
    const center = cellCenter(cell, layout);
    ctx.globalAlpha = 1 - progress;
    drawCrystal(ctx, center.x, center.y, layout.radius * (0.88 + progress * 0.6), cell.color, true);
    ctx.globalAlpha = 0.8 - progress * 0.6;
    ctx.strokeStyle = "#ffe08a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(center.x, center.y, layout.radius * (1 + progress * 1.6), 0, Math.PI * 2);
    ctx.stroke();
  }

  for (const cell of effects.dropped) {
    const center = cellCenter(cell, layout);
    ctx.globalAlpha = 1 - progress * 0.45;
    drawCrystal(ctx, center.x, center.y + progress * layout.radius * 7, layout.radius * 0.88, cell.color);
  }

  for (const cell of effects.damaged) {
    const center = cellCenter(cell, layout);
    ctx.globalAlpha = 1 - progress;
    ctx.strokeStyle = "#ffcf68";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(center.x, center.y, layout.radius * (1.1 + progress), 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
};

const drawHud = (ctx: CanvasRenderingContext2D, state: GameState, width: number): void => {
  const panelWidth = Math.min(width - 28, 620);
  const panelX = (width - panelWidth) / 2;

  ctx.save();
  ctx.fillStyle = "rgba(18, 12, 18, .72)";
  ctx.roundRect(panelX, 12, panelWidth, 64, 16);
  ctx.fill();

  ctx.fillStyle = "#fff7d7";
  ctx.font = "700 18px system-ui, sans-serif";
  ctx.fillText(`Level ${state.level.id}: ${state.level.name}`, panelX + 14, 38);

  ctx.font = "700 16px system-ui, sans-serif";
  ctx.fillText(`Atış: ${state.shotsRemaining}`, panelX + 14, 62);
  ctx.fillText(`Skor: ${state.score}`, panelX + panelWidth - 118, 62);

  if (state.lastEvent?.callout) {
    ctx.textAlign = "center";
    ctx.font = "800 24px system-ui, sans-serif";
    ctx.fillStyle = "#ffe08a";
    ctx.fillText(state.lastEvent.callout, width / 2, 112);
  }
  ctx.restore();
};

const drawLauncher = (ctx: CanvasRenderingContext2D, state: GameState, shooter: AimPoint, radius: number, hideCurrent: boolean): void => {
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, .28)";
  ctx.beginPath();
  ctx.arc(shooter.x, shooter.y + radius * 0.5, radius * 1.4, 0, Math.PI * 2);
  ctx.fill();

  if (!hideCurrent) {
    drawCrystal(ctx, shooter.x, shooter.y, radius, state.launcher.current, true);
  }
  drawCrystal(ctx, shooter.x + radius * 2.35, shooter.y + radius * 0.28, radius * 0.62, state.launcher.reserve);

  ctx.fillStyle = "#f8e6bd";
  ctx.font = "700 12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("sonraki", shooter.x + radius * 2.35, shooter.y + radius * 1.38);
  ctx.restore();
};

const drawWalls = (ctx: CanvasRenderingContext2D, layout: BoardLayout, height: number): void => {
  ctx.save();
  const top = layout.originY + layout.radius * 0.3;
  const bottom = Math.min(height - layout.radius * 3.2, layout.originY + layout.height);

  ctx.strokeStyle = "rgba(255, 224, 138, .14)";
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 16]);
  ctx.beginPath();
  ctx.moveTo(layout.originX + layout.radius, top);
  ctx.lineTo(layout.originX + layout.radius, bottom);
  ctx.moveTo(layout.originX + layout.width - layout.radius, top);
  ctx.lineTo(layout.originX + layout.width - layout.radius, bottom);
  ctx.stroke();
  ctx.restore();
};

export const renderGame = (
  ctx: CanvasRenderingContext2D,
  state: GameState,
  layout: BoardLayout,
  shooter: AimPoint,
  options: {
    width: number;
    height: number;
    showChrome: boolean;
    aimTrace?: AimTrace;
    fullAim: boolean;
    colorBlindMode: boolean;
    projectile?: ProjectileRenderState;
    effects?: EffectRenderState;
  },
): void => {
  const { width, height, showChrome, aimTrace, fullAim, colorBlindMode, projectile, effects } = options;
  drawCaveBackground(ctx, width, height);
  if (showChrome) {
    drawHud(ctx, state, width);
    drawWalls(ctx, layout, height);
  }

  for (const cell of state.board.cells.values()) {
    const center = cellCenter(cell, layout);
    drawCrystal(ctx, center.x, center.y, layout.radius * 0.88, cell.color, false, colorBlindMode);

    if (cell.obstacle === "rock" || cell.obstacle === "fossil") {
      ctx.save();
      ctx.strokeStyle = cell.obstacle === "rock" ? "#8f7b65" : "#d5b36c";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(center.x, center.y, layout.radius * 0.98, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (cell.obstacle === "chain") {
      ctx.save();
      ctx.strokeStyle = "#e9d7a3";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(center.x - layout.radius * 0.7, center.y - layout.radius * 0.7);
      ctx.lineTo(center.x + layout.radius * 0.7, center.y + layout.radius * 0.7);
      ctx.moveTo(center.x + layout.radius * 0.7, center.y - layout.radius * 0.7);
      ctx.lineTo(center.x - layout.radius * 0.7, center.y + layout.radius * 0.7);
      ctx.stroke();
      ctx.restore();
    }

    if (cell.special) {
      ctx.save();
      ctx.fillStyle = "#fff7d7";
      ctx.font = `900 ${Math.round(layout.radius * 0.75)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "#000";
      ctx.shadowBlur = 4;
      const specialText =
        cell.special === "lightning" ? "Z" : cell.special === "mega-bomb" ? "*" : cell.special === "drill" ? ">" : cell.special === "wild" ? "?" : "!";
      ctx.fillText(specialText, center.x, center.y + 1);
      ctx.restore();
    }
  }

  drawEffects(ctx, layout, effects);
  if (showChrome) {
    drawAim(ctx, aimTrace, fullAim);
  }
  if (projectile) {
    drawCrystal(ctx, projectile.position.x, projectile.position.y, layout.radius, projectile.color, true, colorBlindMode);
  }
  if (showChrome) {
    drawLauncher(ctx, state, shooter, layout.radius, Boolean(projectile));
  }

  if (showChrome && state.status !== "playing") {
    ctx.save();
    ctx.fillStyle = "rgba(18, 12, 18, .76)";
    ctx.fillRect(0, 0, width, height);
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff7d7";
    ctx.font = "900 34px system-ui, sans-serif";
    ctx.fillText(state.status === "won" ? "Mağara Açıldı!" : "Çok Yaklaştın!", width / 2, height / 2 - 18);
    ctx.font = "700 17px system-ui, sans-serif";
    ctx.fillText("Tekrar başlatmak için dokun.", width / 2, height / 2 + 20);
    ctx.restore();
  }
};
