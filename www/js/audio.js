/**
 * Calisthenics Roulette — Audio Engine
 * Synthesised sound effects via Web Audio API.
 * Punchy, energetic gaming feel — zero external audio files.
 */

let audioCtx = null;
let enabled = true;

/**
 * Lazily create / resume the AudioContext.
 * Must be called from a user-gesture handler the first time.
 */
function getCtx() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch (e) {
    return null; // audio unavailable — callers must handle null
  }
}

/**
 * Helper: play a single oscillator note.
 * @param {Object} opts
 * @param {number} opts.frequency  - Hz
 * @param {string} opts.type       - 'sine' | 'square' | 'sawtooth' | 'triangle'
 * @param {number} opts.duration   - seconds
 * @param {number} opts.gain       - 0-1
 * @param {number} opts.delay      - seconds offset from now
 * @param {number} opts.decayTime  - exponential ramp duration in seconds
 * @param {BiquadFilterNode|null} opts.filter - optional filter to route through
 */
function playTone({ frequency, type = 'sine', duration = 0.1, gain = 0.5, delay = 0, decayTime = 0.08, filter = null }) {
  const ctx = getCtx();
  if (!ctx) return;
  try {
  const now = ctx.currentTime + delay;

  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, now);

  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(gain, now);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.connect(gainNode);

  if (filter) {
    gainNode.connect(filter);
    filter.connect(ctx.destination);
  } else {
    gainNode.connect(ctx.destination);
  }

  osc.start(now);
  osc.stop(now + duration + 0.05);
  } catch (e) { /* audio is non-critical — never break the caller */ }
}

/**
 * Helper: play a short burst of white noise (for clicks / pops).
 * @param {number} duration - seconds
 * @param {number} gain     - 0-1
 */
function playNoise(duration = 0.02, gain = 0.4) {
  const ctx = getCtx();
  if (!ctx) return;
  try {
  const now = ctx.currentTime;
  const sampleRate = ctx.sampleRate;
  const length = Math.ceil(sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1);
  }

  const src = ctx.createBufferSource();
  src.buffer = buffer;

  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(gain, now);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

  src.connect(gainNode);
  gainNode.connect(ctx.destination);
  src.start(now);
  src.stop(now + duration + 0.01);
  } catch (e) { /* audio is non-critical — never break the caller */ }
}

export const Audio = {
  /**
   * Initialise the AudioContext (call on first user interaction).
   */
  init() {
    const ctx = getCtx();
    if (!ctx) return;
    // iOS unlock: playing a one-sample silent buffer from inside a user
    // gesture fully "unlocks" the AudioContext so later programmatic
    // sounds (timer beeps, spin ticks) actually play.
    try {
      const buffer = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.start(0);
    } catch (e) { /* ignore */ }
    if (ctx.state === 'suspended') ctx.resume();
  },

  /**
   * Enable or disable all sound effects.
   * @param {boolean} bool
   */
  setEnabled(bool) {
    enabled = bool;
  },

  /**
   * @returns {boolean}
   */
  isEnabled() {
    return enabled;
  },

  // ── Sound Effects ───────────────────────────────────────────

  /**
   * Roulette spin tick — short percussive click with varying pitch.
   */
  spinTick() {
    if (!enabled) return;
    const pitch = 800 + Math.random() * 600; // 800-1400 Hz variety
    playTone({ frequency: pitch, type: 'square', duration: 0.025, gain: 0.25, decayTime: 0.02 });
  },

  /**
   * Spin complete — rising synth chord (C5, E5, G5).
   */
  spinComplete() {
    if (!enabled) return;
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, i) => {
      playTone({ frequency: freq, type: 'triangle', duration: 0.4, gain: 0.35, delay: i * 0.08, decayTime: 0.3 });
    });
  },

  /**
   * Timer tick — sharp beep for last 3 seconds of rest.
   */
  timerTick() {
    if (!enabled) return;
    playTone({ frequency: 880, type: 'sine', duration: 0.08, gain: 0.5, decayTime: 0.06 });
  },

  /**
   * Rest complete — bell / gong sound.
   */
  restComplete() {
    if (!enabled) return;
    playTone({ frequency: 523.25, type: 'sine', duration: 0.8, gain: 0.5, decayTime: 0.7 });
    playTone({ frequency: 659.25, type: 'sine', duration: 0.8, gain: 0.35, delay: 0.01, decayTime: 0.7 });
  },

  /**
   * Workout complete — ascending victory arpeggio with filtered sawtooth.
   */
  workoutComplete() {
    if (!enabled) return;
    const ctx = getCtx();
    if (!ctx) return;
    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5

    // Shared lowpass filter for warmth.
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, ctx.currentTime);
    filter.Q.setValueAtTime(2, ctx.currentTime);

    notes.forEach((freq, i) => {
      playTone({
        frequency: freq,
        type: 'sawtooth',
        duration: 0.5,
        gain: 0.3,
        delay: i * 0.12,
        decayTime: 0.4,
        filter
      });
    });
  },

  /**
   * Button press — very short white noise pop.
   */
  buttonPress() {
    if (!enabled) return;
    playNoise(0.015, 0.3);
  },

  // ── Haptics ─────────────────────────────────────────────────

  /**
   * Trigger device vibration if supported.
   * @param {number|number[]} pattern - Duration(s) in ms.
   */
  vibrate(pattern) {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  }
};
