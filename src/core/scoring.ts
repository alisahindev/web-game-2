export const scoreResolution = (poppedCount: number, droppedCount: number, combo: number): number => {
  const popScore = poppedCount * 10;
  const clusterBonus = poppedCount >= 6 ? poppedCount * 8 : poppedCount >= 4 ? poppedCount * 4 : 0;
  const dropScore = droppedCount * 25;
  const comboScore = combo > 1 ? combo * 50 : 0;

  return popScore + clusterBonus + dropScore + comboScore;
};

export const calloutForResolution = (poppedCount: number, droppedCount: number): string | undefined => {
  if (droppedCount >= 8) return "Kristal Yağmuru!";
  if (droppedCount >= 4) return "Büyük Düşüş!";
  if (poppedCount >= 6) return "Taş Gibi!";
  return undefined;
};
