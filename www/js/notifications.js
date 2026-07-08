// ─────────────────────────────────────────────────────────────
// Notifications — daily streak reminder via Capacitor
// LocalNotifications. No-op on web (preview) where Capacitor
// isn't injected.
// ─────────────────────────────────────────────────────────────

const REMINDER_ID = 4200; // arbitrary but stable id we own end-to-end
const REMINDER_BODIES = [
  "Don't break the chain — spin a quick one. 🎰",
  "Five minutes is enough. Keep the streak alive. 🔥",
  "Your streak is waiting on you. Time to spin.",
  "Quick set today? Future-you will thank you. 💪",
  "One spin keeps the streak alive."
];

function plugin() {
  // Capacitor injects window.Capacitor on native; absent on web.
  return (typeof window !== 'undefined'
    && window.Capacitor
    && window.Capacitor.Plugins
    && window.Capacitor.Plugins.LocalNotifications) || null;
}

function isNative() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform
    && window.Capacitor.isNativePlatform());
}

function pickBody() {
  // Random pick is non-deterministic but the system caches anyway —
  // good enough for variety across days.
  return REMINDER_BODIES[Math.floor(Math.random() * REMINDER_BODIES.length)];
}

// Tomorrow at the given local hour:minute.
function tomorrowAt(hour, minute) {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, minute, 0, 0);
  return d;
}

export const Notifications = {
  /** True iff the plugin is loaded (i.e. running natively on iOS). */
  isAvailable() {
    return !!plugin() && isNative();
  },

  /**
   * Ask the OS for permission to send notifications.
   * Returns 'granted' | 'denied' | 'prompt' | 'unavailable'.
   */
  async requestPermission() {
    const p = plugin();
    if (!p) return 'unavailable';
    try {
      const res = await p.requestPermissions();
      return res?.display || 'prompt';
    } catch {
      return 'denied';
    }
  },

  /** Returns the current permission status without prompting. */
  async getPermissionStatus() {
    const p = plugin();
    if (!p) return 'unavailable';
    try {
      const res = await p.checkPermissions();
      return res?.display || 'prompt';
    } catch {
      return 'denied';
    }
  },

  /**
   * Schedule a repeating daily reminder at the given local time.
   * Uses `schedule.on` (UNCalendarNotificationTrigger with repeats on iOS) —
   * the documented reliable pattern for "every day at H:MM". The previous
   * `at` + `every: 'day'` combo is handled inconsistently by the iOS plugin.
   * Cancels any existing reminder first so we never stack duplicates.
   * @param {number} hour 0-23
   * @param {number} minute 0-59
   */
  async scheduleDaily(hour = 19, minute = 0) {
    const p = plugin();
    if (!p) return false;
    try {
      await p.cancel({ notifications: [{ id: REMINDER_ID }] });
      await p.schedule({
        notifications: [{
          id: REMINDER_ID,
          title: 'Keep your streak alive 🔥',
          body: pickBody(),
          schedule: {
            on: { hour, minute },
            allowWhileIdle: true
          }
        }]
      });
      return true;
    } catch (err) {
      console.warn('scheduleDaily failed', err);
      return false;
    }
  },

  /**
   * Schedule a single one-shot reminder for TOMORROW at the given time.
   * Used right after a workout: the streak is kept today, so today's
   * repeating ping is cancelled and replaced with one nudge tomorrow.
   * (The repeating schedule is re-armed on the next app open.)
   */
  async scheduleOneShotTomorrow(hour = 19, minute = 0) {
    const p = plugin();
    if (!p) return false;
    try {
      await p.cancel({ notifications: [{ id: REMINDER_ID }] });
      await p.schedule({
        notifications: [{
          id: REMINDER_ID,
          title: 'Keep your streak alive 🔥',
          body: pickBody(),
          schedule: {
            at: tomorrowAt(hour, minute),
            allowWhileIdle: true
          }
        }]
      });
      return true;
    } catch (err) {
      console.warn('scheduleOneShotTomorrow failed', err);
      return false;
    }
  },

  /** Cancel the daily reminder. */
  async cancel() {
    const p = plugin();
    if (!p) return;
    try {
      await p.cancel({ notifications: [{ id: REMINDER_ID }] });
    } catch { /* ignore */ }
  },

  /**
   * Called after a workout is logged: don't ping for a streak the user
   * already kept today — replace the schedule with one nudge tomorrow.
   */
  async onWorkoutLogged(hour = 19, minute = 0) {
    await this.scheduleOneShotTomorrow(hour, minute);
  }
};
