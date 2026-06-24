/**
 * Push-Up Roulette — Storage Layer
 * Synchronous LocalStorage persistence for all app data.
 */

const KEYS = {
  WORKOUTS: 'pr_workouts',
  STATS: 'pr_stats',
  STREAK: 'pr_streak',
  PREFERENCES: 'pr_preferences',
  ACHIEVEMENTS: 'pr_achievements',
  FEEDBACK: 'pr_feedback'
};

const DEFAULT_PREFERENCES = {
  difficulty: 'all',
  mode: 'standard',
  soundEnabled: true,
  vibrationEnabled: true,
  theme: 'dark'
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
  localStorage.setItem(key, JSON.stringify(value));
}

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
    const data = JSON.parse(json);
    for (const [label, key] of Object.entries(KEYS)) {
      if (data[label] !== undefined && data[label] !== null) {
        save(key, data[label]);
      }
    }
  }
};
