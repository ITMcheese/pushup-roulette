/**
 * Bodyweight Workout Roulette — Achievements System
 * Gamification badges with automatic unlock detection and badge gallery rendering.
 */

import { Storage } from './storage.js';

const ACHIEVEMENT_DEFS = [
  { id: 'first_workout', name: 'First Rep', description: 'Complete your first workout', icon: '🌟', check: (stats) => stats.totalWorkouts >= 1 },
  { id: 'push_100', name: 'Century Club', description: '100 total reps', icon: '💯', check: (stats) => stats.totalPushups >= 100 },
  { id: 'push_1000', name: 'Thousand Strong', description: '1,000 total reps', icon: '🏋️', check: (stats) => stats.totalPushups >= 1000 },
  { id: 'push_10000', name: 'Bodyweight Legend', description: '10,000 total reps', icon: '👑', check: (stats) => stats.totalPushups >= 10000 },
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
  },

  /**
   * Render the full badge gallery into a container element.
   * Unlocked badges are vibrant; locked badges are dimmed with a lock overlay.
   *
   * @param {HTMLElement} containerEl
   */
  renderBadges(containerEl) {
    const achievements = this.getAll();
    containerEl.innerHTML = '';

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px;';

    for (const a of achievements) {
      const card = document.createElement('div');
      card.style.cssText = `
        display:flex;flex-direction:column;align-items:center;
        padding:16px 8px;border-radius:12px;text-align:center;
        transition:transform 0.2s,box-shadow 0.2s;
        cursor:default;position:relative;
        background:${a.unlocked ? 'var(--surface,rgba(255,255,255,0.08))' : 'var(--surface-dim,rgba(255,255,255,0.03))'};
        opacity:${a.unlocked ? '1' : '0.45'};
        border:1px solid ${a.unlocked ? 'var(--primary,#6c5ce7)' : 'var(--border,rgba(255,255,255,0.08))'};
      `;

      // Hover lift for unlocked badges.
      if (a.unlocked) {
        card.addEventListener('mouseenter', () => {
          card.style.transform = 'translateY(-4px)';
          card.style.boxShadow = '0 6px 20px rgba(108,92,231,0.3)';
        });
        card.addEventListener('mouseleave', () => {
          card.style.transform = '';
          card.style.boxShadow = '';
        });
      }

      const icon = document.createElement('span');
      icon.style.cssText = 'font-size:2rem;margin-bottom:8px;';
      icon.textContent = a.unlocked ? a.icon : '🔒';

      const name = document.createElement('strong');
      name.style.cssText = 'font-size:0.8rem;margin-bottom:4px;color:var(--text,#fff);';
      name.textContent = a.name;

      const desc = document.createElement('span');
      desc.style.cssText = 'font-size:0.65rem;color:var(--text-secondary,#aaa);line-height:1.3;';
      desc.textContent = a.description;

      card.appendChild(icon);
      card.appendChild(name);
      card.appendChild(desc);
      grid.appendChild(card);
    }

    containerEl.appendChild(grid);
  }
};
