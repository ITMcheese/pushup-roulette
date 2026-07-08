/**
 * Calisthenics Roulette — Achievements System
 * Gamification badges with automatic unlock detection and badge gallery rendering.
 */

import { Storage } from './storage.js';

const ACHIEVEMENT_DEFS = [
  { id: 'first_workout', name: 'First Rep', description: 'Complete your first workout', icon: '🌟', check: (stats) => stats.totalWorkouts >= 1 },
  { id: 'push_100', name: 'Century Club', description: '100 total reps', icon: '💯', check: (stats) => stats.totalPushups >= 100 },
  { id: 'push_1000', name: 'Thousand Strong', description: '1,000 total reps', icon: '🏋️', check: (stats) => stats.totalPushups >= 1000 },
  { id: 'push_10000', name: 'Calisthenics Legend', description: '10,000 total reps', icon: '👑', check: (stats) => stats.totalPushups >= 10000 },
  { id: 'streak_7', name: 'Week Warrior', description: '7-day streak', icon: '🔥', check: (stats) => stats.currentStreak >= 7 },
  { id: 'streak_30', name: 'Monthly Monster', description: '30-day streak', icon: '⚡', check: (stats) => stats.currentStreak >= 30 },
  { id: 'workouts_10', name: 'Getting Serious', description: 'Complete 10 workouts', icon: '💪', check: (stats) => stats.totalWorkouts >= 10 },
  { id: 'workouts_50', name: 'Dedicated', description: 'Complete 50 workouts', icon: '🎖️', check: (stats) => stats.totalWorkouts >= 50 },
  { id: 'chaos_survivor', name: 'Chaos Survivor', description: 'Complete a Chaos Mode workout', icon: '🌪️', check: (stats) => stats.chaosCompleted },
  { id: 'elite_performer', name: 'Elite Performer', description: 'Complete an Elite difficulty workout', icon: '🏆', check: (stats) => stats.eliteCompleted },
];

let onUnlockCallback = null;

export const Achievements = {
  /**
   * Return all achievement definitions with an `unlocked` boolean added.
   * @returns {Array<Object>}
   */
  getAll() {
    const unlockedIds = new Set(Storage.getUnlockedAchievements());
    return ACHIEVEMENT_DEFS.map(def => ({
      ...def,
      unlocked: unlockedIds.has(def.id)
    }));
  },

  /**
   * Return only the unlocked achievement definitions.
   * @returns {Array<Object>}
   */
  getUnlocked() {
    return this.getAll().filter(a => a.unlocked);
  },

  /**
   * Check all achievements against current stats.
   * Persists newly unlocked achievements and fires the onUnlock callback for each.
   *
   * @param {Object} stats - { totalPushups, totalWorkouts, currentStreak, chaosCompleted, eliteCompleted }
   * @returns {Array<Object>} Array of newly unlocked achievement defs.
   */
  check(stats) {
    const alreadyUnlocked = new Set(Storage.getUnlockedAchievements());
    const newlyUnlocked = [];

    for (const def of ACHIEVEMENT_DEFS) {
      if (alreadyUnlocked.has(def.id)) continue;

      if (def.check(stats)) {
        Storage.unlockAchievement(def.id);
        newlyUnlocked.push({ ...def, unlocked: true });

        if (onUnlockCallback) {
          onUnlockCallback({ ...def, unlocked: true });
        }
      }
    }

    return newlyUnlocked;
  },

  /**
   * Register a callback that fires for each newly unlocked achievement.
   * @param {Function} callback - Receives the achievement def object.
   */
  onUnlock(callback) {
    onUnlockCallback = callback;
  }
};
