import { allCells } from "./core/board";
import { applyBooster, applyShot, createGame, remainingForObjective, restartGame, swapLauncher } from "./core/engine";
import { cellCenter, traceAim, type BoardLayout } from "./core/geometry";
import { levels } from "./core/levels";
import { pathLength, pointAtDistance } from "./core/path";
import type { AimPoint, AimTrace, BoosterKind, Coord, GameState, GameStatus, ResolutionEvent } from "./core/types";
import { playSound, setSoundEnabled } from "./ui/sound";
import { renderGame } from "./ui/canvas";
import { boosterLabel, objectiveText } from "./ui/theme";
import "./styles.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root not found");
}

app.innerHTML = `
  <main class="game-shell" aria-label="Caveman Crystal Pop">
    <canvas aria-label="Oyun alanı" data-testid="game-canvas"></canvas>
    <div class="ui-layer" data-testid="ui-layer"></div>
  </main>
`;

const canvas = app.querySelector("canvas");
const ctx = canvas?.getContext("2d");
const ui = app.querySelector<HTMLDivElement>(".ui-layer");

if (!canvas || !ctx || !ui) {
  app.innerHTML = `<p class="fallback">Canvas desteklenmiyor.</p>`;
  throw new Error("Canvas is not available");
}

type Screen =
  | "menu"
  | "map"
  | "level-start"
  | "game"
  | "pause"
  | "daily"
  | "daily-challenge"
  | "achievements"
  | "howto"
  | "settings"
  | "chest"
  | "episode";

type Settings = {
  sound: boolean;
  reducedMotion: boolean;
  colorBlindMode: boolean;
};

type ProfileStats = {
  wins: number;
  popped: number;
  dropped: number;
  rockBroken: number;
  bestScore: number;
};

type DailyProgress = {
  stamp: string;
  wins: number;
  claimed: boolean;
  challengePlayed: boolean;
};

type Profile = {
  unlockedLevel: number;
  coins: number;
  stars: Record<number, number>;
  settings: Settings;
  stats: ProfileStats;
  daily: DailyProgress;
};

type ActiveShot = {
  color: GameState["launcher"]["current"];
  trace: AimTrace;
  startedAt: number;
  totalDistance: number;
  speed: number;
};

type ActiveEffect = {
  event: ResolutionEvent;
  startedAt: number;
  duration: number;
};

const profileKey = "caveman-crystal-pop-profile";
const defaultSettings: Settings = { sound: true, reducedMotion: false, colorBlindMode: false };
const defaultStats: ProfileStats = { wins: 0, popped: 0, dropped: 0, rockBroken: 0, bestScore: 0 };

const defaultProfile: Profile = {
  unlockedLevel: 1,
  coins: 0,
  stars: {},
  settings: defaultSettings,
  stats: defaultStats,
  daily: { stamp: "", wins: 0, claimed: false, challengePlayed: false },
};

const todayStamp = (): string => new Date().toISOString().slice(0, 10);

const normalizeDaily = (daily: Partial<DailyProgress> | undefined): DailyProgress => {
  const stamp = todayStamp();
  if (!daily || daily.stamp !== stamp) {
    return { stamp, wins: 0, claimed: false, challengePlayed: false };
  }

  return {
    stamp,
    wins: daily.wins ?? 0,
    claimed: daily.claimed ?? false,
    challengePlayed: daily.challengePlayed ?? false,
  };
};

const loadProfile = (): Profile => {
  try {
    const raw = window.localStorage.getItem(profileKey);
    if (!raw) return defaultProfile;

    const parsed = JSON.parse(raw) as Partial<Profile>;
    return {
      ...defaultProfile,
      ...parsed,
      settings: { ...defaultSettings, ...parsed.settings },
      stats: { ...defaultStats, ...parsed.stats },
      daily: normalizeDaily(parsed.daily),
      stars: parsed.stars ?? {},
    };
  } catch {
    return defaultProfile;
  }
};

const saveProfile = (nextProfile: Profile): void => {
  window.localStorage.setItem(profileKey, JSON.stringify(nextProfile));
};

let profile = loadProfile();
updateDocumentSettings();
let screen: Screen = "menu";
let settingsReturn: Screen = "menu";
let currentLevelIndex = 0;
let pendingLevelIndex = 0;
let state: GameState = createGame(levels[currentLevelIndex]);
let aimTrace: AimTrace | undefined;
let selectedBooster: BoosterKind | undefined;
let isAiming = false;
let layout: BoardLayout;
let shooter: AimPoint;
let viewport = { width: 0, height: 0 };
let animationFrame: number | undefined;
let shotTimeout: number | undefined;
let activeShot: ActiveShot | undefined;
let activeEffect: ActiveEffect | undefined;
let reportedTerminalStatus: GameStatus | undefined;

const dailyLevelIndex = (): number => {
  const stamp = todayStamp();
  const sum = [...stamp].reduce((total, char) => total + char.charCodeAt(0), 0);
  return sum % levels.length;
};

const computeLayout = (): void => {
  const pixelRatio = window.devicePixelRatio || 1;
  const cssWidth = Math.max(320, window.innerWidth);
  const cssHeight = Math.max(560, window.innerHeight);

  canvas.width = Math.floor(cssWidth * pixelRatio);
  canvas.height = Math.floor(cssHeight * pixelRatio);
  canvas.style.width = "100vw";
  canvas.style.height = "100dvh";
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  viewport = { width: cssWidth, height: cssHeight };

  const topChrome = cssWidth < 480 ? 126 : 98;
  const availableWidth = Math.min(cssWidth - 28, 620);
  const availableHeight = cssHeight - topChrome - 220;
  const widthRadius = availableWidth / (state.board.cols * 2 + 1);
  const heightRadius = availableHeight / (2 + (state.board.rows - 1) * Math.sqrt(3));
  const radius = Math.max(15, Math.min(30, widthRadius, heightRadius));
  const boardWidth = state.board.cols * radius * 2 + radius;
  const boardHeight = radius * 2 + (state.board.rows - 1) * Math.sqrt(3) * radius;

  layout = {
    radius,
    originX: (cssWidth - boardWidth) / 2,
    originY: topChrome,
    width: boardWidth,
    height: boardHeight,
  };
  shooter = {
    x: cssWidth / 2,
    y: cssHeight - radius * 2.2,
  };
};

const effectForNow = (now: number) => {
  if (!activeEffect) return undefined;
  return {
    popped: activeEffect.event.popped,
    dropped: activeEffect.event.dropped,
    damaged: activeEffect.event.damaged,
    progress: (now - activeEffect.startedAt) / activeEffect.duration,
  };
};

const activeShotPosition = (now: number): AimPoint | undefined => {
  if (!activeShot) return undefined;
  const distance = ((now - activeShot.startedAt) / 1000) * activeShot.speed;
  return pointAtDistance(activeShot.trace.path, distance);
};

const renderCanvas = (now = performance.now()): void => {
  const projectilePosition = activeShotPosition(now);
  canvas.dataset.screen = screen;
  canvas.dataset.status = state.status;
  canvas.dataset.shots = String(state.shotsRemaining);
  canvas.dataset.activeShot = activeShot ? "true" : "false";
  canvas.dataset.selectedBooster = selectedBooster ?? "";

  renderGame(ctx, state, layout, shooter, {
    width: viewport.width,
    height: viewport.height,
    showChrome: screen === "game",
    aimTrace,
    fullAim: state.aimAssistShots > 0,
    colorBlindMode: profile.settings.colorBlindMode,
    projectile: activeShot && projectilePosition ? { color: activeShot.color, position: projectilePosition } : undefined,
    effects: effectForNow(now),
  });
};

const terminalTitle = (): string => (state.status === "won" ? "Mağara Açıldı!" : "Çok Yaklaştın!");

const levelObjectiveText = (levelIndex: number): string =>
  levels[levelIndex].objectives
    .map((objective) => {
      if (objective.kind === "clear") {
        return objective.amount > 0 ? `${objective.amount} kristal kalana kadar temizle` : "Tüm kristalleri temizle";
      }
      if (objective.kind === "pop-color") return `${objective.amount} kristal patlat`;
      if (objective.kind === "break-obstacle") return `${objective.amount} engel kır`;
      if (objective.kind === "drop") return `${objective.amount} kristal düşür`;
      return `${objective.amount} puana ulaş`;
    })
    .join(" · ");

const objectiveMarkup = (): string =>
  state.level.objectives
    .map((objective) => `<span class="chip">${objectiveText(objective, remainingForObjective(state, objective))}</span>`)
    .join("");

const boosterMarkup = (): string =>
  (Object.keys(state.boosters) as BoosterKind[])
    .map((booster) => {
      const count = state.boosters[booster];
      const label = boosterLabel[booster];
      const selected = selectedBooster === booster ? " is-selected" : "";
      return `<button class="booster${selected}" data-action="booster" data-booster="${booster}" ${count <= 0 ? "disabled" : ""}>
        <strong>${label.short}</strong><span>${count}</span>
      </button>`;
    })
    .join("");

const mapMarkup = (): string =>
  levels
    .map((level) => {
      const locked = level.id > profile.unlockedLevel;
      const stars = profile.stars[level.id] ?? 0;
      return `<button class="level-node" data-action="level" data-level="${level.id}" ${locked ? "disabled" : ""}>
        <span>${level.id}</span><small>${locked ? "kilit" : "★".repeat(stars || 1)}</small>
      </button>`;
    })
    .join("");

const dailyDone = (): boolean => profile.daily.claimed;

const dailyReady = (): boolean => profile.daily.wins >= 3 && !profile.daily.claimed;

const achievementDefs = [
  { id: "pop100", label: "100 kristal patlat", target: 100, value: () => profile.stats.popped },
  { id: "drop50", label: "50 büyük düşüş yap", target: 50, value: () => profile.stats.dropped },
  { id: "win10", label: "10 level kazan", target: 10, value: () => profile.stats.wins },
  { id: "rock20", label: "20 kaya kır", target: 20, value: () => profile.stats.rockBroken },
  { id: "score5000", label: "5000 en iyi skor", target: 5000, value: () => profile.stats.bestScore },
] as const;

const achievementMarkup = (): string =>
  achievementDefs
    .map((achievement) => {
      const value = Math.min(achievement.target, achievement.value());
      const done = value >= achievement.target;
      return `<div class="achievement ${done ? "is-done" : ""}">
        <strong>${achievement.label}</strong>
        <span>${value}/${achievement.target}</span>
      </div>`;
    })
    .join("");

function updateDocumentSettings(): void {
  setSoundEnabled(profile.settings.sound);
  document.body.classList.toggle("is-reduced-motion", profile.settings.reducedMotion);
  document.body.classList.toggle("is-colorblind", profile.settings.colorBlindMode);
}

const syncUi = (): void => {
  canvas.dataset.screen = screen;
  canvas.dataset.status = state.status;
  canvas.dataset.shots = String(state.shotsRemaining);

  if (screen === "menu") {
    ui.innerHTML = `
      <section class="screen-card menu-card">
        <h1>Kavernix</h1>
        <p>Kristali fırlat. Patlat. Büyük düşüş yap.</p>
        <button class="primary" data-action="continue">Mağaraya Gir</button>
        <button data-action="map">Level Haritası</button>
        <button data-action="daily">Günlük Görev</button>
        <button data-action="daily-challenge">Günlük Challenge</button>
        <button data-action="achievements">Başarımlar</button>
        <button data-action="howto">Nasıl Oynanır</button>
        <button data-action="settings">Ayarlar</button>
      </section>`;
    return;
  }

  if (screen === "level-start") {
    const level = levels[pendingLevelIndex];
    ui.innerHTML = `
      <section class="screen-card">
        <h2>Level ${level.id}</h2>
        <p>${level.name}</p>
        <p>${levelObjectiveText(pendingLevelIndex)}</p>
        <p>${level.shots} atış</p>
        <button class="primary" data-action="begin-level">Atışa Başla</button>
        <button data-action="map">Harita</button>
      </section>`;
    return;
  }

  if (screen === "map") {
    ui.innerHTML = `
      <section class="map-panel">
        <header><button data-action="menu">Geri</button><strong>Mağara Haritası</strong><span>${profile.coins} coin</span></header>
        <div class="level-grid">${mapMarkup()}</div>
      </section>`;
    return;
  }

  if (screen === "daily") {
    const remainingWins = Math.max(0, 3 - profile.daily.wins);
    ui.innerHTML = `
      <section class="screen-card">
        <h2>Günlük Görev</h2>
        <p>${dailyDone() ? "Bugünkü sandık alındı." : remainingWins === 0 ? "Sandık hazır." : `${remainingWins} level daha kazan.`}</p>
        <button class="primary" data-action="daily-reward" ${dailyReady() ? "" : "disabled"}>Sandığı Aç</button>
        <button data-action="daily-challenge">Günlük Challenge</button>
        <button data-action="menu">Geri</button>
      </section>`;
    return;
  }

  if (screen === "daily-challenge") {
    const level = levels[dailyLevelIndex()];
    ui.innerHTML = `
      <section class="screen-card">
        <h2>Günlük Challenge</h2>
        <p>Bugünün mağarası: Level ${level.id} · ${level.name}</p>
        <p>${profile.daily.challengePlayed ? "Bugünkü challenge oynandı." : "Tek hedef: iyi skor, temiz atış."}</p>
        <button class="primary" data-action="play-daily" ${profile.daily.challengePlayed ? "disabled" : ""}>Challenge Oyna</button>
        <button data-action="menu">Geri</button>
      </section>`;
    return;
  }

  if (screen === "achievements") {
    ui.innerHTML = `
      <section class="screen-card wide-card">
        <h2>Başarımlar</h2>
        <div class="achievement-list">${achievementMarkup()}</div>
        <button data-action="menu">Geri</button>
      </section>`;
    return;
  }

  if (screen === "howto") {
    ui.innerHTML = `
      <section class="screen-card">
        <h2>Nasıl Oynanır</h2>
        <p>Aynı kristalden 3+ yap. Tavana bağlı kalmayanlar düşer. Booster zor anda yardım eder.</p>
        <button class="primary" data-action="continue">Oyna</button>
        <button data-action="menu">Geri</button>
      </section>`;
    return;
  }

  if (screen === "settings") {
    ui.innerHTML = `
      <section class="screen-card">
        <h2>Ayarlar</h2>
        <button class="toggle ${profile.settings.sound ? "is-on" : ""}" data-action="toggle-sound">Ses: ${profile.settings.sound ? "Açık" : "Kapalı"}</button>
        <button class="toggle ${profile.settings.reducedMotion ? "is-on" : ""}" data-action="toggle-motion">Az animasyon: ${profile.settings.reducedMotion ? "Açık" : "Kapalı"}</button>
        <button class="toggle ${profile.settings.colorBlindMode ? "is-on" : ""}" data-action="toggle-colorblind">Renk körü modu: ${profile.settings.colorBlindMode ? "Açık" : "Kapalı"}</button>
        <button data-action="settings-back">Geri</button>
        <button data-action="menu">Menü</button>
      </section>`;
    return;
  }

  if (screen === "pause") {
    ui.innerHTML = `
      <section class="screen-card">
        <h2>Duraklatıldı</h2>
        <button class="primary" data-action="resume">Devam</button>
        <button data-action="settings">Ayarlar</button>
        <button data-action="retry">Tekrar Başlat</button>
        <button data-action="map">Harita</button>
      </section>`;
    return;
  }

  if (screen === "chest") {
    ui.innerHTML = `
      <section class="screen-card">
        <h2>Ödül Sandığı</h2>
        <p>+75 coin. Mağara cömert.</p>
        <button class="primary" data-action="menu">Tamam</button>
      </section>`;
    return;
  }

  if (screen === "episode") {
    ui.innerHTML = `
      <section class="screen-card">
        <h2>Yeni Bölge</h2>
        <p>Mağara derinleşti. Kristaller sertleşti.</p>
        <button class="primary" data-action="next">Devam</button>
        <button data-action="map">Harita</button>
      </section>`;
    return;
  }

  const terminal = state.status !== "playing";
  ui.innerHTML = `
    <section class="game-ui">
      <div class="objective-row">${objectiveMarkup()}</div>
      <button class="pause-button" data-action="pause">II</button>
      <div class="booster-row">${boosterMarkup()}</div>
      ${selectedBooster ? `<div class="target-hint">${boosterLabel[selectedBooster].name}: hedef seç</div>` : ""}
      ${
        terminal
          ? `<div class="result-modal">
              <h2>${terminalTitle()}</h2>
              <p>Skor ${state.score} · ${state.shotsRemaining} atış kaldı</p>
              <button class="primary" data-action="${state.status === "won" ? (state.level.id % 10 === 0 ? "episode" : "next") : "retry"}">${state.status === "won" ? "Sonraki Level" : "Tekrar Dene"}</button>
              <button data-action="map">Harita</button>
            </div>`
          : ""
      }
    </section>`;
};

const startEffect = (event: ResolutionEvent | undefined, now = performance.now()): void => {
  if (profile.settings.reducedMotion) return;
  if (!event || (event.popped.length === 0 && event.dropped.length === 0 && event.damaged.length === 0)) return;
  activeEffect = { event, startedAt: now, duration: event.source === "booster" ? 420 : 520 };
  requestTick();
};

const brokenRockCount = (event: ResolutionEvent): number =>
  [...event.popped, ...event.damaged].filter((cell) => cell.obstacle === "rock").length;

const updateStatsForEvent = (event: ResolutionEvent | undefined): void => {
  if (!event) return;

  profile = {
    ...profile,
    stats: {
      ...profile.stats,
      popped: profile.stats.popped + event.popped.length,
      dropped: profile.stats.dropped + event.dropped.length,
      rockBroken: profile.stats.rockBroken + brokenRockCount(event),
      bestScore: Math.max(profile.stats.bestScore, state.score),
    },
  };
  saveProfile(profile);
};

const updateProfileAfterWin = (): void => {
  if (reportedTerminalStatus === state.status) return;
  reportedTerminalStatus = state.status;

  if (state.status !== "won") {
    playSound("lose");
    return;
  }

  const stars = state.shotsRemaining >= 7 ? 3 : state.shotsRemaining >= 3 ? 2 : 1;
  profile = {
    ...profile,
    unlockedLevel: Math.min(levels.length, Math.max(profile.unlockedLevel, state.level.id + 1)),
    coins: profile.coins + 25 + stars * 10,
    stars: { ...profile.stars, [state.level.id]: Math.max(profile.stars[state.level.id] ?? 0, stars) },
    stats: {
      ...profile.stats,
      wins: profile.stats.wins + 1,
      bestScore: Math.max(profile.stats.bestScore, state.score),
    },
    daily: {
      ...profile.daily,
      wins: Math.min(3, profile.daily.wins + 1),
    },
  };
  saveProfile(profile);
  playSound("win");
};

function requestTick(): void {
  if (animationFrame !== undefined) {
    cancelAnimationFrame(animationFrame);
  }
  animationFrame = requestAnimationFrame(tick);
}

const clearPendingTick = (): void => {
  if (animationFrame !== undefined) {
    cancelAnimationFrame(animationFrame);
    animationFrame = undefined;
  }
};

const clearShotTimeout = (): void => {
  if (shotTimeout !== undefined) {
    window.clearTimeout(shotTimeout);
    shotTimeout = undefined;
  }
};

const finishActiveShot = (now = performance.now()): void => {
  if (!activeShot) return;

  const nextState = applyShot(state, activeShot.trace.landing);
  state = nextState;
  activeShot = undefined;
  clearShotTimeout();
  playSound(state.lastEvent && state.lastEvent.popped.length > 0 ? "pop" : "stick");
  updateStatsForEvent(state.lastEvent);
  startEffect(state.lastEvent, now);
  updateProfileAfterWin();
  syncUi();
  renderCanvas(now);
};

function tick(now: number): void {
  animationFrame = undefined;

  if (activeShot) {
    const distance = ((now - activeShot.startedAt) / 1000) * activeShot.speed;
    if (distance >= activeShot.totalDistance) {
      finishActiveShot(now);
    }
  }

  if (activeEffect && now - activeEffect.startedAt >= activeEffect.duration) {
    activeEffect = undefined;
  }

  renderCanvas(now);

  if (activeShot || activeEffect) {
    requestTick();
  }
}

const startLevel = (levelIndex: number): void => {
  clearPendingTick();
  clearShotTimeout();
  currentLevelIndex = Math.max(0, Math.min(levels.length - 1, levelIndex));
  state = createGame(levels[currentLevelIndex], 104729 + currentLevelIndex * 97);
  screen = "game";
  aimTrace = undefined;
  selectedBooster = undefined;
  activeShot = undefined;
  activeEffect = undefined;
  reportedTerminalStatus = undefined;
  computeLayout();
  syncUi();
  renderCanvas();
};

const openLevelStart = (levelIndex: number): void => {
  pendingLevelIndex = Math.max(0, Math.min(levels.length - 1, levelIndex));
  screen = "level-start";
  syncUi();
  renderCanvas();
};

const cellAtPoint = (point: AimPoint): Coord | undefined => {
  const candidate = allCells(state.board)
    .map((cell) => {
      const center = cellCenter(cell, layout);
      return { coord: { row: cell.row, col: cell.col }, distance: Math.hypot(center.x - point.x, center.y - point.y) };
    })
    .filter((candidateCell) => candidateCell.distance <= layout.radius * 1.45)
    .sort((a, b) => a.distance - b.distance)[0];

  return candidate?.coord;
};

const pointerToCanvasPoint = (event: PointerEvent): AimPoint => {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
};

const updateAim = (event: PointerEvent): void => {
  if (!isAiming || screen !== "game" || state.status !== "playing" || activeShot || selectedBooster) return;

  const point = pointerToCanvasPoint(event);
  const angle = Math.atan2(point.y - shooter.y, point.x - shooter.x);
  aimTrace = traceAim(state.board, angle, layout, shooter);
  renderCanvas();
};

const startShotAnimation = (trace: AimTrace): void => {
  if (profile.settings.reducedMotion) {
    state = applyShot(state, trace.landing);
    playSound(state.lastEvent && state.lastEvent.popped.length > 0 ? "pop" : "stick");
    updateStatsForEvent(state.lastEvent);
    updateProfileAfterWin();
    syncUi();
    renderCanvas();
    return;
  }

  clearShotTimeout();
  const totalDistance = Math.max(1, pathLength(trace.path));
  const baseSpeed = Math.max(520, layout.radius * 22);
  const durationMs = Math.max(220, Math.min(900, (totalDistance / baseSpeed) * 1000));

  activeShot = {
    color: state.launcher.current,
    trace,
    startedAt: performance.now(),
    totalDistance,
    speed: totalDistance / (durationMs / 1000),
  };
  shotTimeout = window.setTimeout(() => finishActiveShot(), durationMs + 120);
  playSound("shoot");
  requestTick();
};

const useImmediateBooster = (booster: BoosterKind): void => {
  const nextState = applyBooster(state, booster);
  if (nextState === state) return;
  state = nextState;
  selectedBooster = undefined;
  playSound("booster");
  syncUi();
  renderCanvas();
};

const useTargetBooster = (booster: BoosterKind, target: Coord): void => {
  const nextState = applyBooster(state, booster, target);
  if (nextState === state) return;
  state = nextState;
  selectedBooster = undefined;
  playSound("booster");
  startEffect(state.lastEvent);
  updateStatsForEvent(state.lastEvent);
  updateProfileAfterWin();
  syncUi();
  renderCanvas();
};

canvas.addEventListener("pointerdown", (event) => {
  if (screen !== "game" || activeShot || state.status !== "playing") return;

  const point = pointerToCanvasPoint(event);

  if (selectedBooster === "hammer" || selectedBooster === "cave-bomb") {
    const target = cellAtPoint(point);
    if (target) useTargetBooster(selectedBooster, target);
    return;
  }

  canvas.setPointerCapture(event.pointerId);
  isAiming = true;
  updateAim(event);
});

canvas.addEventListener("pointermove", updateAim);

canvas.addEventListener("pointerup", () => {
  if (!isAiming || !aimTrace) return;

  startShotAnimation(aimTrace);
  aimTrace = undefined;
  isAiming = false;
  renderCanvas();
});

canvas.addEventListener("pointercancel", () => {
  isAiming = false;
  aimTrace = undefined;
  renderCanvas();
});

ui.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]");
  if (!button) return;

  const action = button.dataset.action;

  if (action === "continue") openLevelStart(profile.unlockedLevel - 1);
  if (action === "menu") {
    screen = "menu";
    syncUi();
    renderCanvas();
  }
  if (action === "map") {
    screen = "map";
    syncUi();
    renderCanvas();
  }
  if (action === "daily") {
    screen = "daily";
    syncUi();
  }
  if (action === "daily-challenge") {
    screen = "daily-challenge";
    syncUi();
  }
  if (action === "achievements") {
    screen = "achievements";
    syncUi();
  }
  if (action === "howto") {
    screen = "howto";
    syncUi();
  }
  if (action === "pause") {
    screen = "pause";
    syncUi();
  }
  if (action === "settings") {
    settingsReturn = screen === "settings" ? settingsReturn : screen;
    screen = "settings";
    syncUi();
  }
  if (action === "settings-back") {
    screen = settingsReturn;
    syncUi();
    renderCanvas();
  }
  if (action === "resume") {
    screen = "game";
    syncUi();
    renderCanvas();
  }
  if (action === "level") {
    const levelId = Number(button.dataset.level);
    if (Number.isFinite(levelId)) openLevelStart(levelId - 1);
  }
  if (action === "begin-level") startLevel(pendingLevelIndex);
  if (action === "play-daily" && !profile.daily.challengePlayed) {
    profile = { ...profile, daily: { ...profile.daily, challengePlayed: true } };
    saveProfile(profile);
    startLevel(dailyLevelIndex());
  }
  if (action === "retry") startLevel(currentLevelIndex);
  if (action === "next") startLevel(Math.min(levels.length - 1, currentLevelIndex + 1));
  if (action === "episode") {
    screen = "episode";
    syncUi();
  }
  if (action === "daily-reward" && dailyReady()) {
    profile = { ...profile, coins: profile.coins + 75, daily: { ...profile.daily, claimed: true } };
    saveProfile(profile);
    screen = "chest";
    syncUi();
    playSound("win");
  }
  if (action === "toggle-sound") {
    profile = { ...profile, settings: { ...profile.settings, sound: !profile.settings.sound } };
    saveProfile(profile);
    updateDocumentSettings();
    syncUi();
  }
  if (action === "toggle-motion") {
    profile = { ...profile, settings: { ...profile.settings, reducedMotion: !profile.settings.reducedMotion } };
    saveProfile(profile);
    updateDocumentSettings();
    syncUi();
  }
  if (action === "toggle-colorblind") {
    profile = { ...profile, settings: { ...profile.settings, colorBlindMode: !profile.settings.colorBlindMode } };
    saveProfile(profile);
    updateDocumentSettings();
    syncUi();
    renderCanvas();
  }
  if (action === "booster") {
    const booster = button.dataset.booster as BoosterKind | undefined;
    if (!booster || state.boosters[booster] <= 0 || state.status !== "playing") return;

    if (booster === "hammer" || booster === "cave-bomb") {
      selectedBooster = selectedBooster === booster ? undefined : booster;
      syncUi();
      renderCanvas();
      return;
    }

    useImmediateBooster(booster);
  }
});

window.addEventListener("keydown", (event) => {
  if (activeShot) return;

  if (event.key.toLowerCase() === "r") {
    state = restartGame(state);
    reportedTerminalStatus = undefined;
    syncUi();
    renderCanvas();
  }

  if (event.key === " ") {
    state = swapLauncher(state);
    syncUi();
    renderCanvas();
  }
});

window.addEventListener("resize", () => {
  computeLayout();
  renderCanvas();
});

computeLayout();
syncUi();
renderCanvas();
