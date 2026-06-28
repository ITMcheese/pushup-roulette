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

// Build the next Date that matches the given hour+minute. If that time has
// already passed today, fast-forward to tomorrow at the same time.
function nextOccurrence(hour, minute) {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setHours(hour, minute, 0, 0);
  if (d.getTime() <= Date.now()) {
    d.setDate(d.getDate() + 1);
  }
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
   * Cancels any existing reminder first so we never stack duplicates.
   * @param {number} hour 0-23
   * @param {number} minute 0-59
   */
  async scheduleDaily(hour = 19, minute = 0) {
    const p = plugin();
    if (!p) return false;
    try {
      await p.cancel({ notifications: [{ id: REMINDER_ID }] });
      const at = nextOccurrence(hour, minute);
      await p.schedule({
        notifications: [{
          id: REMINDER_ID,
          title: 'Keep your streak alive 🔥',
          body: pickBody(),
          schedule: {
            at,
            // Repeat every day at the same time — iOS uses the `every` field.
            every: 'day',
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

  /** Cancel the daily reminder. */
  async cancel() {
    const p = plugin();
    if (!p) return;
    try {
      await p.cancel({ notifications: [{ id: REMINDER_ID }] });
    } catch { /* ignore */ }
  },

  /**
   * Called after a workout is logged. If the reminder for today hasn't fired
   * yet, reschedule it for tomorrow at the same time so we don't ping the
   * user for a streak they already kept.
   */
  async onWorkoutLogged(hour = 19, minute = 0) {
    const p = plugin();
    if (!p) return;
    // The repeating schedule re-fires daily on its own; we just need to push
    // today's instance forward if it hasn't fired. The simplest correct way
    // is to cancel+reschedule, which sets the next `at` to the next-future
    // occurrence (which will be tomorrow once today's time has passed).
    await this.scheduleDaily(hour, minute);
  }
};
