/**
 * Synthesised sound effects via Web Audio API.
 * All functions are fire-and-forget; errors are silently swallowed so a
 * missing AudioContext (e.g. server-side, locked policy) never breaks the UI.
 */

function ctx(): AudioContext | null {
  try {
    return new AudioContext();
  } catch {
    return null;
  }
}

/** Aggressive battle-cry synth for truco calls (Truco! / Seis! / Nove! / Doze!) */
export function playTrucoSound(): void {
  const ac = ctx();
  if (!ac) return;

  const t = ac.currentTime;

  // Layer 1: hard sawtooth — the "shout"
  const osc1 = ac.createOscillator();
  const g1 = ac.createGain();
  osc1.type = 'sawtooth';
  osc1.frequency.setValueAtTime(440, t);
  osc1.frequency.exponentialRampToValueAtTime(260, t + 0.18);
  osc1.frequency.exponentialRampToValueAtTime(200, t + 0.38);
  g1.gain.setValueAtTime(0, t);
  g1.gain.linearRampToValueAtTime(0.38, t + 0.015);
  g1.gain.setValueAtTime(0.38, t + 0.06);
  g1.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
  osc1.connect(g1);
  g1.connect(ac.destination);
  osc1.start(t);
  osc1.stop(t + 0.45);

  // Layer 2: square undertone — body
  const osc2 = ac.createOscillator();
  const g2 = ac.createGain();
  osc2.type = 'square';
  osc2.frequency.setValueAtTime(220, t);
  osc2.frequency.exponentialRampToValueAtTime(130, t + 0.4);
  g2.gain.setValueAtTime(0, t);
  g2.gain.linearRampToValueAtTime(0.18, t + 0.02);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  osc2.connect(g2);
  g2.connect(ac.destination);
  osc2.start(t);
  osc2.stop(t + 0.42);

  osc1.onended = () => { void ac.close(); };
}

/** FM-synthesised duck quack — two quick bursts */
export function playPatoSound(): void {
  function quack(ac: AudioContext, startTime: number, freq: number, mod: number): void {
    const carrier = ac.createOscillator();
    const modOsc = ac.createOscillator();
    const modGain = ac.createGain();
    const env = ac.createGain();

    modOsc.frequency.setValueAtTime(mod, startTime);
    modGain.gain.setValueAtTime(freq * 2.5, startTime);
    modGain.gain.exponentialRampToValueAtTime(1, startTime + 0.11);

    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(freq, startTime);
    carrier.frequency.exponentialRampToValueAtTime(freq * 0.48, startTime + 0.13);

    env.gain.setValueAtTime(0, startTime);
    env.gain.linearRampToValueAtTime(0.42, startTime + 0.01);
    env.gain.exponentialRampToValueAtTime(0.001, startTime + 0.16);

    modOsc.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(env);
    env.connect(ac.destination);

    modOsc.start(startTime);
    carrier.start(startTime);
    modOsc.stop(startTime + 0.18);
    carrier.stop(startTime + 0.18);
  }

  const ac = ctx();
  if (!ac) return;

  const t = ac.currentTime;
  quack(ac, t, 900, 80);
  quack(ac, t + 0.22, 820, 70);

  setTimeout(() => { void ac.close(); }, 600);
}
