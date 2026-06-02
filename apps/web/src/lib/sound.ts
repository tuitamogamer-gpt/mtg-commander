// Tiny WebAudio cue generator — no audio files to bundle. Each cue is a short
// tone; gated by the user's sound setting at the call site.

type Cue = "draw" | "tap" | "shuffle" | "life" | "turn";

const TONES: Record<Cue, { freq: number; dur: number; type: OscillatorType }> = {
  draw: { freq: 660, dur: 0.07, type: "sine" },
  tap: { freq: 440, dur: 0.05, type: "triangle" },
  shuffle: { freq: 220, dur: 0.12, type: "sawtooth" },
  life: { freq: 330, dur: 0.08, type: "sine" },
  turn: { freq: 520, dur: 0.14, type: "square" },
};

let ctx: AudioContext | null = null;

export function playCue(cue: Cue): void {
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const { freq, dur, type } = TONES[cue];
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  } catch {
    /* audio unavailable — ignore */
  }
}
