type SoundKind = "shoot" | "stick" | "pop" | "booster" | "win" | "lose";

let audioContext: AudioContext | undefined;
let soundEnabled = true;

export const setSoundEnabled = (enabled: boolean): void => {
  soundEnabled = enabled;
};

const ensureContext = (): AudioContext | undefined => {
  if (!("AudioContext" in window)) return undefined;
  audioContext ??= new AudioContext();
  return audioContext;
};

const tone = (frequency: number, duration: number, gain: number, delay = 0): void => {
  const context = ensureContext();
  if (!context) return;

  const oscillator = context.createOscillator();
  const volume = context.createGain();
  const start = context.currentTime + delay;
  const end = start + duration;

  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.type = "triangle";
  volume.gain.setValueAtTime(0.0001, start);
  volume.gain.exponentialRampToValueAtTime(gain, start + 0.015);
  volume.gain.exponentialRampToValueAtTime(0.0001, end);
  oscillator.connect(volume);
  volume.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(end + 0.02);
};

export const playSound = (kind: SoundKind): void => {
  if (!soundEnabled) return;

  const context = ensureContext();
  if (!context) return;
  void context.resume();

  if (kind === "shoot") tone(220, 0.08, 0.04);
  if (kind === "stick") tone(160, 0.05, 0.03);
  if (kind === "pop") {
    tone(420, 0.07, 0.05);
    tone(680, 0.09, 0.04, 0.035);
  }
  if (kind === "booster") {
    tone(260, 0.08, 0.04);
    tone(520, 0.12, 0.045, 0.05);
  }
  if (kind === "win") {
    tone(420, 0.08, 0.04);
    tone(620, 0.1, 0.045, 0.08);
    tone(820, 0.14, 0.045, 0.16);
  }
  if (kind === "lose") tone(140, 0.18, 0.035);
};
