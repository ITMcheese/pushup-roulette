/**
 * Push-Up Roulette — Theme Manager
 * Handles dark/light mode toggling, persistence, and system preference detection.
 */

const STORAGE_KEY = 'pr_theme';

export const Theme = {
  /**
   * Initialise the theme on app start.
   * Priority: localStorage preference → system color-scheme preference → 'dark' default.
   */
  init() {
    let theme = localStorage.getItem(STORAGE_KEY);

    if (!theme) {
      // Detect system preference.
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        theme = 'light';
      } else {
        theme = 'dark';
      }
    }

    this.set(theme);
  },

  /**
   * Toggle between dark and light themes.
   * @returns {string} The new active theme.
   */
  toggle() {
    const newTheme = this.get() === 'dark' ? 'light' : 'dark';
    this.set(newTheme);
    return newTheme;
  },

  /**
   * Get the current theme string.
   * @returns {string} 'dark' or 'light'
   */
  get() {
    return document.documentElement.getAttribute('data-theme') || 'dark';
  },

  /**
   * Set a specific theme and persist.
   * @param {string} theme - 'dark' or 'light'
   */
  set(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  },

  /**
   * Get the toggle-button icon for the current theme.
   * Shows what the user will switch TO (sun ☀️ when in dark mode, moon 🌙 when in light mode).
   * @returns {string}
   */
  getIcon() {
    return this.get() === 'dark' ? '☀️' : '🌙';
  }
};
