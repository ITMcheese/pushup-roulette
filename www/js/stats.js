/**
 * Stats — Progress tracking and weekly bar-chart visualisation.
 *
 * Renders lifetime statistics into DOM elements and draws a 7-day
 * push-up bar chart on an HTML <canvas> (no libraries).
 * All data is pulled from the Storage module.
 */

import { Storage } from './storage.js';

/* ── module ────────────────────────────────────────────────────────── */

export const Stats = {
  chartCanvas: null,
  chartCtx:    null,

  /* ── public API ────────────────────────────────────────────────── */

  /**
   * Attach to the <canvas> element used for the weekly chart.
   * @param {HTMLCanvasElement|null} chartCanvasEl
   */
  init(chartCanvasEl) {
    this.chartCanvas = chartCanvasEl;
    if (chartCanvasEl) {
      this.chartCtx = chartCanvasEl.getContext('2d');
    }
  },

  /**
   * Render all lifetime stats into the progress-view DOM elements and
   * redraw the weekly chart.
   *
   * @param {Object} elements
   * @param {HTMLElement} elements.totalPushups
   * @param {HTMLElement} elements.totalWorkouts
   * @param {HTMLElement} elements.currentStreak
   * @param {HTMLElement} elements.longestStreak
   * @param {HTMLElement} elements.favorite
   */
  render(elements) {
    const stats    = Storage.getLifetimeStats();
    const streak   = Storage.getStreak();
    const favorite = Storage.getFavoriteExercise();

    elements.totalPushups.textContent   = this._formatNumber(stats.totalPushups);
    elements.totalWorkouts.textContent  = stats.totalWorkouts;
    elements.currentStreak.textContent  = streak.current;
    elements.longestStreak.textContent  = streak.longest;
    elements.favorite.textContent       = favorite || 'None yet';

    this.renderChart();
  },

  /**
   * (Re-)draw the weekly push-up bar chart on the canvas.
   * Automatically handles high-DPI / Retina displays.
   */
  renderChart() {
    if (!this.chartCtx) return;

    const canvas = this.chartCanvas;
    const ctx    = this.chartCtx;
    const dpr    = window.devicePixelRatio || 1;

    /* ── size the canvas for crisp rendering ───────────────────── */
    const cssWidth  = canvas.offsetWidth;
    const cssHeight = canvas.offsetHeight;

    canvas.width  = cssWidth  * dpr;
    canvas.height = cssHeight * dpr;
    ctx.scale(dpr, dpr);

    const width  = cssWidth;
    const height = cssHeight;

    const padding = { top: 20, right: 20, bottom: 40, left: 40 };

    /* ── data ──────────────────────────────────────────────────── */
    const workouts    = Storage.getRecentWorkouts(7);
    const days        = this._getLast7Days();
    const dailyTotals = days.map(day =>
      workouts
        .filter(w => w.date && w.date.startsWith(day.iso))
        .reduce((sum, w) => sum + (w.totalPushups || 0), 0)
    );
    const maxVal = Math.max(...dailyTotals, 1);

    /* ── clear ─────────────────────────────────────────────────── */
    ctx.clearRect(0, 0, width, height);

    /* ── dimensions ────────────────────────────────────────────── */
    const chartWidth  = width  - padding.left - padding.right;
    const chartHeight = height - padding.top  - padding.bottom;
    const barGap      = chartWidth / 7;
    const barWidth    = barGap * 0.6;

    /* ── themed colours ────────────────────────────────────────── */
    const style       = getComputedStyle(document.documentElement);
    const accentColor = style.getPropertyValue('--accent').trim()         || '#00ff88';
    const textColor   = style.getPropertyValue('--text-secondary').trim() || '#8888aa';

    /* ── draw bars ─────────────────────────────────────────────── */
    days.forEach((day, i) => {
      const x         = padding.left + i * barGap + (barGap - barWidth) / 2;
      const barHeight = (dailyTotals[i] / maxVal) * chartHeight;
      const y         = padding.top + chartHeight - barHeight;

      // Rounded-top bar
      ctx.fillStyle  = accentColor;
      ctx.globalAlpha = dailyTotals[i] > 0 ? 0.8 : 0.15;
      ctx.beginPath();
      const r = Math.min(barWidth / 2, 6);
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + barWidth - r, y);
      ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + r);
      ctx.lineTo(x + barWidth, padding.top + chartHeight);
      ctx.lineTo(x, padding.top + chartHeight);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Value label above bar
      if (dailyTotals[i] > 0) {
        ctx.fillStyle = accentColor;
        ctx.font      = '11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(dailyTotals[i], x + barWidth / 2, y - 6);
      }

      // Day label below bar
      ctx.fillStyle = textColor;
      ctx.font      = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(day.label, x + barWidth / 2, height - 10);
    });

    /* ── baseline ──────────────────────────────────────────────── */
    ctx.strokeStyle = textColor;
    ctx.globalAlpha = 0.2;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + chartHeight);
    ctx.lineTo(width - padding.right, padding.top + chartHeight);
    ctx.stroke();
    ctx.globalAlpha = 1;
  },

  /* ── internal helpers ──────────────────────────────────────────── */

  /**
   * Generate date info for the last 7 calendar days.
   * @returns {{ iso: string, label: string }[]}
   */
  _getLast7Days() {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({
        iso:   d.toISOString().split('T')[0], // "YYYY-MM-DD"
        label: i === 0 ? 'Today' : dayNames[d.getDay()]
      });
    }
    return days;
  },

  /**
   * Human-friendly number formatting.
   * @param {number} num
   * @returns {string}
   */
  _formatNumber(num) {
    if (num >= 10000) return (num / 1000).toFixed(1) + 'k';
    return num.toLocaleString();
  }
};
