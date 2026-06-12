import type { BoosterKind, CrystalColor, ObstacleKind, Objective } from "../core/types";

export const crystalStyle: Record<CrystalColor, { fill: string; core: string; stroke: string; label: string }> = {
  amber: { fill: "#f7a934", core: "#ffe08a", stroke: "#7b4517", label: "Amber" },
  lava: { fill: "#e34a2f", core: "#ffb45f", stroke: "#692319", label: "Lav" },
  ice: { fill: "#62c7ff", core: "#d5f6ff", stroke: "#1b5675", label: "Buz" },
  moss: { fill: "#5fbf64", core: "#c6ef89", stroke: "#244e2e", label: "Yosun" },
  moon: { fill: "#d9d7c9", core: "#ffffff", stroke: "#69685f", label: "Ay" },
  spark: { fill: "#a764ff", core: "#ffd3ff", stroke: "#43216f", label: "Kıvılcım" },
};

export const obstacleLabel: Record<ObstacleKind, string> = {
  rock: "Kaya",
  "ice-shell": "Buz",
  chain: "Zincir",
  fossil: "Fosil",
  "lava-bubble": "Lav",
};

export const boosterLabel: Record<BoosterKind, { name: string; short: string }> = {
  hammer: { name: "Hedef Çekici", short: "Çekiç" },
  "color-shift": { name: "Renk Değiştirici", short: "Renk" },
  "extra-shots": { name: "Ekstra Atış", short: "+5" },
  "cave-bomb": { name: "Mağara Bombası", short: "Bomba" },
  "long-aim": { name: "Nişan Uzatıcı", short: "Nişan" },
};

export const objectiveText = (objective: Objective, remaining: number): string => {
  switch (objective.kind) {
    case "clear":
      return `Temizle: ${remaining}`;
    case "remove":
      return `Temizle: ${remaining}`;
    case "pop-color":
      return `${crystalStyle[objective.color].label}: ${remaining}`;
    case "break-obstacle":
      return `${obstacleLabel[objective.obstacle]} kır: ${remaining}`;
    case "drop":
      return `Düşür: ${remaining}`;
    case "score":
      return `Puan: ${remaining}`;
  }
};
