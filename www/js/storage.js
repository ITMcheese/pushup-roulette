/**
 * Calisthenics Roulette — Storage Layer
 * Synchronous LocalStorage persistence for all app data.
 */

const KEYS = {
  WORKOUTS: 'pr_workouts',
  STATS: 'pr_stats',
  STREAK: 'pr_streak',
  PREFERENCES: 'pr_preferences',
  ACHIEVEMENTS: 'pr_achievements',
  FEEDBACK: 'pr_feedback',
  PERSONAL_RECORDS: 'pr_records'
};

// Keys must match what savePreferences()/loadPreferences() in app.js
// actually read and write ('sound'/'vibration' — NOT soundEnabled).
const DEFAULT_PREFERENCES = {
  difficulty: 'all',
  category: 'all',
  mode: 'standard',
  sound: true,
  vibration: true,
  theme: 'dark',
  reminderEnabled: false,
  reminderHour: 19,
  reminderMinute: 0
};

/**
 * Safe JSON parse with fallback.
 */
function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * Stringify and persist.
 */
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('Storage quota exceeded, pruning old workouts');
    try {
      const workouts = JSON.parse(localStorage.getItem(KEYS.WORKOUTS) || '[]');
      if (workouts.length > 100) {
        localStorage.setItem(KEYS.WORKOUTS, JSON.stringify(workouts.slice(0, 100)));
      }
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) { /* storage completely full */ }
  }
}

const MAX_WORKOUT_HISTORY = 500;

/**
 * Return the start-of-day timestamp for a Date (midnight, local time).
 */
function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export const Storage = {
  // ── Workout History ───────────────────────────────────────────

  /**
   * Save a completed workout record.
   * @param {Object} workout - { date, exerciseId, exerciseName, reps, sets, rest, duration, totalPushups, isGroup }
   */
  saveWorkout(workout) {
    const workouts = load(KEYS.WORKOUTS, []);
    const record = {
      ...workout,
      date: workout.date || new Date().toISOString(),
      timestamp: Date.now()
    };
    workouts.unshift(record); // newest first
    if (workouts.length > MAX_WORKOUT_HISTORY) {
      workouts.length = MAX_WORKOUT_HISTORY;
    }
    save(KEYS.WORKOUTS, workouts);
  },

  /**
   * Return all saved workouts, most recent first.
   * @returns {Array}
   */
  getWorkouts() {
    return load(KEYS.WORKOUTS, []);
  },

  /**
   * Return workouts from the last N days.
   * @param {number} days
   * @returns {Array}
   */
  getRecentWorkouts(days = 7) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return this.getWorkouts().filter(w => (w.timestamp || new Date(w.date).getTime()) >= cutoff);
  },

  // ── Lifetime Stats ────────────────────────────────────────────

  /**
   * Get aggregated lifetime stats.
   * @returns {{ totalPushups: number, totalWorkouts: number, totalDuration: number }}
   */
  getLifetimeStats() {
    return load(KEYS.STATS, { totalPushups: 0, totalWorkouts: 0, totalDuration: 0 });
  },

  /**
   * Increment lifetime stats after a workout.
   * @param {number} pushups - Push-ups completed this session.
   * @param {number} duration - Duration in seconds this session.
   */
  updateLifetimeStats(pushups, duration) {
    const stats = this.getLifetimeStats();
    stats.totalPushups += pushups;
    stats.totalWorkouts += 1;
    stats.totalDuration += duration;
    save(KEYS.STATS, stats);
  },

  // ── Streak Tracking ───────────────────────────────────────────

  /**
   * Get the current streak data.
   * @returns {{ current: number, longest: number, lastWorkoutDate: string|null }}
   */
  getStreak() {
    return load(KEYS.STREAK, { current: 0, longest: 0, lastWorkoutDate: null });
  },

  /**
   * Update streak after completing a workout. Auto-calculates current streak.
   * Should be called once per completed workout.
   */
  updateStreak() {
    const streak = this.getStreak();
    const today = startOfDay(new Date());

    if (streak.lastWorkoutDate) {
      const lastDay = startOfDay(new Date(streak.lastWorkoutDate));

      if (lastDay === today) {
        // Already worked out today — no streak change.
        return;
      }

      const oneDayMs = 24 * 60 * 60 * 1000;
      if (today - lastDay === oneDayMs) {
        // Consecutive day — extend streak.
        streak.current += 1;
      } else {
        // Gap detected — reset streak.
        streak.current = 1;
      }
    } else {
      // First ever workout.
      streak.current = 1;
    }

    streak.longest = Math.max(streak.longest, streak.current);
    streak.lastWorkoutDate = new Date().toISOString();
    save(KEYS.STREAK, streak);
  },

  // ── Preferences ───────────────────────────────────────────────

  /**
   * Get user preferences (merged with defaults for forward-compat).
   * @returns {Object}
   */
  getPreferences() {
    const stored = load(KEYS.PREFERENCES, {});
    return { ...DEFAULT_PREFERENCES, ...stored };
  },

  /**
   * Save user preferences (partial or full).
   * @param {Object} prefs
   */
  savePreferences(prefs) {
    const current = this.getPreferences();
    save(KEYS.PREFERENCES, { ...current, ...prefs });
  },

  // ── Achievements ──────────────────────────────────────────────

  /**
   * Get the set of unlocked achievement IDs.
   * @returns {string[]}
   */
  getUnlockedAchievements() {
    return load(KEYS.ACHIEVEMENTS, []);
  },

  /**
   * Mark an achievement as unlocked.
   * @param {string} id
   */
  unlockAchievement(id) {
    const unlocked = this.getUnlockedAchievements();
    if (!unlocked.includes(id)) {
      unlocked.push(id);
      save(KEYS.ACHIEVEMENTS, unlocked);
    }
  },

  // ── Derived Queries ───────────────────────────────────────────

  /**
   * Return the name of the most frequently performed exercise.
   * @returns {string|null}
   */
  getFavoriteExercise() {
    const workouts = this.getWorkouts();
    if (workouts.length === 0) return null;

    const counts = {};
    for (const w of workouts) {
      const name = w.exerciseName || w.exerciseId;
      counts[name] = (counts[name] || 0) + 1;
    }

    let maxName = null;
    let maxCount = 0;
    for (const [name, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        maxName = name;
      }
    }
    return maxName;
  },

  // ── Personal Records ──────────────────────────────────────────

  /**
   * Get the full personal-records map.
   * Shape: { [exerciseId]: { exerciseName, icon, unit,
   *                          bestPerSet, totalReps, totalSets,
   *                          longestDuration, lastAchievedAt } }
   * @returns {Object}
   */
  getPersonalRecords() {
    return load(KEYS.PERSONAL_RECORDS, {});
  },

  /**
   * Update PRs after a completed workout.
   * Returns an array of newly-broken records (for toast notifications):
   *   [{ exerciseId, exerciseName, kind: 'bestPerSet'|'totalReps'|'totalSets'|'longestDuration',
   *      previous, current, unit }]
   * @param {{ exerciseId: string, exerciseName: string, icon?: string, unit?: string,
   *           reps: number, sets: number, duration: number, totalPushups: number }} workout
   * @returns {Array}
   */
  updatePersonalRecords(workout) {
    if (!workout || !workout.exerciseId) return [];

    const records = this.getPersonalRecords();
    const id = workout.exerciseId;
    const unit = workout.unit || 'reps';
    const broken = [];

    const existing = records[id] || {
      exerciseName: workout.exerciseName,
      icon: workout.icon || '💪',
      unit,
      bestPerSet: 0,
      totalReps: 0,
      totalSets: 0,
      longestDuration: 0,
      lastAchievedAt: null
    };

    // Always refresh the display fields in case the catalog changed.
    existing.exerciseName = workout.exerciseName || existing.exerciseName;
    if (workout.icon) existing.icon = workout.icon;
    existing.unit = unit;

    const repsPerSet = Number(workout.reps) || 0;
    const totalSets  = Number(workout.sets) || 0;
    const totalReps  = Number(workout.totalPushups) || repsPerSet * totalSets;
    const duration   = Number(workout.duration) || 0;

    if (repsPerSet > (existing.bestPerSet || 0)) {
      broken.push({ exerciseId: id, exerciseName: existing.exerciseName,
                    kind: 'bestPerSet', previous: existing.bestPerSet,
                    current: repsPerSet, unit });
      existing.bestPerSet = repsPerSet;
    }
    if (totalReps > (existing.totalReps || 0)) {
      broken.push({ exerciseId: id, exerciseName: existing.exerciseName,
                    kind: 'totalReps', previous: existing.totalReps,
                    current: totalReps, unit });
      existing.totalReps = totalReps;
    }
    if (totalSets > (existing.totalSets || 0)) {
      broken.push({ exerciseId: id, exerciseName: existing.exerciseName,
                    kind: 'totalSets', previous: existing.totalSets,
                    current: totalSets, unit: 'sets' });
      existing.totalSets = totalSets;
    }
    if (duration > (existing.longestDuration || 0)) {
      // Don't fire a toast for duration alone — it's an implicit consequence
      // of more sets/reps. Just track it silently for the PR card.
      existing.longestDuration = duration;
    }

    if (broken.length > 0) {
      existing.lastAchievedAt = new Date().toISOString();
    }

    records[id] = existing;
    save(KEYS.PERSONAL_RECORDS, records);
    return broken;
  },

  // ── Calendar / Date Queries ──────────────────────────────────

  /**
   * Group workouts by ISO date (YYYY-MM-DD) for calendar rendering.
   * Returns { 'YYYY-MM-DD': [workout, ...] }
   * Only includes dates with at least one workout.
   * @param {number} [year] - 4-digit year to limit to (optional)
   * @param {number} [month] - 0-indexed month to limit to (optional, requires year)
   */
  getWorkoutsByDate(year, month) {
    const grouped = {};
    for (const w of this.getWorkouts()) {
      if (!w.date) continue;
      const d = new Date(w.date);
      if (year != null && d.getFullYear() !== year) continue;
      if (month != null && d.getMonth() !== month) continue;
      // Use LOCAL date so calendar cells match what the user did "today".
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const key = `${yyyy}-${mm}-${dd}`;
      (grouped[key] = grouped[key] || []).push(w);
    }
    return grouped;
  },

  // ── Feedback ──────────────────────────────────────────────────

  /**
   * Save user feedback locally.
   * @param {string} text
   */
  saveFeedback(text) {
    const feedbackList = load(KEYS.FEEDBACK, []);
    feedbackList.push({
      text,
      timestamp: Date.now(),
      date: new Date().toISOString()
    });
    save(KEYS.FEEDBACK, feedbackList);
  },

  // ── Export / Import ───────────────────────────────────────────

  /**
   * Export all persisted data as a JSON string.
   * @returns {string}
   */
  exportData() {
    const data = {};
    for (const [label, key] of Object.entries(KEYS)) {
      data[label] = load(key, null);
    }
    data._exportedAt = new Date().toISOString();
    data._version = 1;
    return JSON.stringify(data, null, 2);
  },

  /**
   * Import data from a JSON string, overwriting all current data.
   * @param {string} json
   */
  importData(json) {
    let data;
    try {
      data = JSON.parse(json);
    } catch {
      throw new Error('Invalid JSON');
    }
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Invalid data format');
    }
    const allowedKeys = new Set(Object.keys(KEYS));
    for (const [label, key] of Object.entries(KEYS)) {
      if (!allowedKeys.has(label)) continue;
      if (Object.prototype.hasOwnProperty.call(data, label) && data[label] !== null) {
        save(key, data[label]);
      }
    }
  }
};
