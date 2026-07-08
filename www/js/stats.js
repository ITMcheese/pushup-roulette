/**
 * Stats — Progress tracking and weekly bar-chart visualisation.
 *
 * Renders lifetime statistics into DOM elements and draws a 7-day
 * workout bar chart on an HTML <canvas> (no libraries).
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
    // Bucket by LOCAL calendar day. Comparing raw ISO (UTC) strings put a
    // 9pm workout on tomorrow's bar and made "Today" miss evening sessions.
    const workouts    = Storage.getRecentWorkouts(8); // 8 days: covers UTC skew
    const days        = this._getLast7Days();
    const dailyTotals = days.map(day =>
      workouts
        .filter(w => w.date && this._localDayKey(new Date(w.date)) === day.iso)
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
   * Local-timezone YYYY-MM-DD key for a Date (NOT UTC/toISOString).
   */
  _localDayKey(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  },

  /**
   * Generate date info for the last 7 calendar days (local time).
   * @returns {{ iso: string, label: string }[]}
   */
  _getLast7Days() {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({
        iso:   this._localDayKey(d),
        label: i === 0 ? 'Today' : dayNames[d.getDay()]
      });
    }
    return days;
  }
};
