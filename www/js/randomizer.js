// ─────────────────────────────────────────────────────────────
//  randomizer.js — Calisthenics Roulette Challenge Generator
// ─────────────────────────────────────────────────────────────

import { getRandomExercise, DIFFICULTIES } from './database.js';

// ─── Workout Modes ───────────────────────────────────────────
// Each mode defines ranges for sets, reps, rest (seconds), and
// a separate secondsRange for isometric / timed exercises.
// ─────────────────────────────────────────────────────────────

export const MODES = {
  QUICK_BURN: {
    name: 'Quick Burn',
    setsRange: [1, 3],
    repsRange: [8, 20],
    restRange: [15, 45],
    secondsRange: [15, 30],
  },
  STANDARD: {
    name: 'Standard',
    setsRange: [3, 5],
    repsRange: [10, 25],
    restRange: [30, 60],
    secondsRange: [20, 45],
  },
  WARRIOR: {
    name: 'Warrior',
    setsRange: [5, 10],
    repsRange: [15, 40],
    restRange: [45, 90],
    secondsRange: [30, 60],
  },
  CHAOS: {
    name: 'Chaos',
    setsRange: [1, 10],
    repsRange: [5, 50],
    restRange: [15, 120],
    secondsRange: [10, 90],
  },
};

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Random integer in [min, max] (inclusive).
 */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Round a value to the nearest multiple of `step`.
 */
function roundTo(value, step) {
  return Math.round(value / step) * step;
}

/**
 * Clamp `value` between `min` and `max`.
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// ─── Difficulty Caps ─────────────────────────────────────────
// Hard ceilings so elite / advanced exercises stay sane.

const DIFFICULTY_CAPS = {
  [DIFFICULTIES.ELITE]: { maxReps: 15, maxSeconds: 30 },
  [DIFFICULTIES.ADVANCED]: { maxReps: 25, maxSeconds: 45 },
  [DIFFICULTIES.INTERMEDIATE]: { maxReps: Infinity, maxSeconds: Infinity },
  [DIFFICULTIES.BEGINNER]: { maxReps: Infinity, maxSeconds: Infinity },
};

// ─── Generators ──────────────────────────────────────────────

/**
 * Generate a challenge for a specific, pre-selected exercise.
 *
 * @param {object}  exercise
 * @param {object}  options
 * @param {string}  options.mode           — Key of MODES (default 'STANDARD')
 *
 * @returns {{ exercise: object, reps: number, sets: number, rest: number, mode: object, unit: string }}
 */
export function generateChallengeForExercise(exercise, options = {}) {
  const {
    mode: modeKey = 'STANDARD',
  } = options;

  const mode = MODES[modeKey] || MODES.STANDARD;

  // ── 1. Determine raw rep / seconds count ──
  const isTimedExercise = exercise.unit === 'seconds';
  const [valueMin, valueMax] = isTimedExercise ? mode.secondsRange : mode.repsRange;
  let rawValue = randInt(valueMin, valueMax);

  // ── 2. Apply difficulty caps ──
  const caps = DIFFICULTY_CAPS[exercise.difficulty] || {};
  const cap = isTimedExercise ? caps.maxSeconds : caps.maxReps;
  if (cap !== undefined && cap !== Infinity) {
    rawValue = clamp(rawValue, valueMin, cap);
  }

  // ── 3. Round to nearest 5 ──
  let value = roundTo(rawValue, 5);
  // Guarantee at least the floor value rounded to 5
  value = Math.max(value, roundTo(valueMin, 5) || 5);

  // ── 4. Sets ──
  let sets = randInt(mode.setsRange[0], mode.setsRange[1]);

  // ── 5. Rest — scale with intensity ──
  //  Higher reps / seconds → longer rest (proportional within the range)
  const intensityRatio = (rawValue - valueMin) / (Math.max(valueMax, valueMin + 1) - valueMin);
  const [restMin, restMax] = mode.restRange;
  let rest = Math.round(restMin + intensityRatio * (restMax - restMin));
  rest = roundTo(rest, 5);
  rest = clamp(rest, restMin, restMax);

  // Elite exercises also get a rest bump
  if (exercise.difficulty === DIFFICULTIES.ELITE) {
    rest = clamp(rest + 15, restMin, restMax + 15);
    rest = roundTo(rest, 5);
  } else if (exercise.difficulty === DIFFICULTIES.ADVANCED) {
    rest = clamp(rest + 10, restMin, restMax + 10);
    rest = roundTo(rest, 5);
  }

  // ── 6. Work time ──
  //  Timed exercises: workTime = the seconds value
  //  Rep exercises:   workTime ≈ reps × 3s (reasonable pace), rounded to 5
  let workTime;
  if (isTimedExercise) {
    workTime = value;
  } else {
    workTime = roundTo(value * 3, 5);
    workTime = Math.max(workTime, 15); // min 15s
    workTime = Math.min(workTime, 180); // max 3 min
  }

  return {
    exercise,
    reps: value,
    sets,
    rest,
    workTime,
    mode,
    unit: exercise.unit,
  };
}

/**
 * Generate a single random challenge.
 *
 * @param {object}  options
 * @param {string}  options.mode           — Key of MODES (default 'STANDARD')
 * @param {string}  options.difficulty     — Difficulty filter or 'all'
 * @param {string}  options.category       — Category filter or 'all'
 * @param {string|null} options.lastExerciseId — ID to avoid repeating
 *
 * @returns {{ exercise: object, reps: number, sets: number, rest: number, mode: object, unit: string }}
 */
export function generateChallenge(options = {}) {
  const {
    difficulty = 'all',
    category = 'all',
    lastExerciseId = null,
  } = options;

  // Pick exercise
  const exercise = getRandomExercise(difficulty, category, lastExerciseId);

  // Generate challenge details
  return generateChallengeForExercise(exercise, options);
}
