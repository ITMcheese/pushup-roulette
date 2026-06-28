// ─────────────────────────────────────────────────────────────
// Progress — renders the workout-history calendar and the
// per-exercise Personal Records list.
// ─────────────────────────────────────────────────────────────

import { Storage } from './storage.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function isoDateKey(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
}

function formatDuration(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.round(totalSeconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export const Progress = {
  // Tracks the month the calendar is currently looking at.
  _viewYear: null,
  _viewMonth: null,
  _selectedDateKey: null,

  init({ gridEl, titleEl, detailEl, prevBtn, nextBtn, prListEl }) {
    this.gridEl    = gridEl;
    this.titleEl   = titleEl;
    this.detailEl  = detailEl;
    this.prListEl  = prListEl;

    const now = new Date();
    this._viewYear  = now.getFullYear();
    this._viewMonth = now.getMonth();

    if (prevBtn) prevBtn.addEventListener('click', () => this._shiftMonth(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => this._shiftMonth(1));
  },

  /** Re-render both calendar and PR list. Safe to call on every view-progress show. */
  render() {
    this._renderCalendar();
    this._renderPRs();
  },

  // ── Calendar ────────────────────────────────────────────────

  _shiftMonth(delta) {
    let m = this._viewMonth + delta;
    let y = this._viewYear;
    while (m < 0)  { m += 12; y -= 1; }
    while (m > 11) { m -= 12; y += 1; }
    this._viewMonth = m;
    this._viewYear  = y;
    this._selectedDateKey = null;
    this._renderCalendar();
  },

  _renderCalendar() {
    if (!this.gridEl || !this.titleEl) return;

    this.titleEl.textContent = `${MONTH_NAMES[this._viewMonth]} ${this._viewYear}`;

    const byDate = Storage.getWorkoutsByDate(this._viewYear, this._viewMonth);
    const today  = new Date();
    const firstOfMonth = new Date(this._viewYear, this._viewMonth, 1);
    const daysInMonth  = new Date(this._viewYear, this._viewMonth + 1, 0).getDate();
    const startWeekday = firstOfMonth.getDay(); // 0 = Sunday

    // Find max workouts-in-a-day for intensity scaling within this month.
    const maxInDay = Object.values(byDate).reduce((m, list) => Math.max(m, list.length), 0);

    this.gridEl.textContent = '';

    // Leading blanks for days before the 1st.
    for (let i = 0; i < startWeekday; i++) {
      const blank = document.createElement('div');
      blank.className = 'cal-cell cal-blank';
      this.gridEl.appendChild(blank);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const cellDate = new Date(this._viewYear, this._viewMonth, day);
      const key = isoDateKey(cellDate);
      const list = byDate[key] || [];
      const count = list.length;

      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cal-cell';
      cell.dataset.date = key;
      if (isSameDay(cellDate, today)) cell.classList.add('cal-today');
      if (count > 0) {
        cell.classList.add('cal-active');
        // 3 intensity tiers based on the busiest day this month.
        const tier = maxInDay <= 1 ? 1
                   : count >= maxInDay ? 3
                   : count >= Math.ceil(maxInDay / 2) ? 2
                   : 1;
        cell.classList.add(`cal-tier-${tier}`);
      }
      if (this._selectedDateKey === key) cell.classList.add('cal-selected');

      const num = document.createElement('span');
      num.className = 'cal-num';
      num.textContent = day;
      cell.appendChild(num);

      if (count > 0) {
        const dot = document.createElement('span');
        dot.className = 'cal-dot';
        cell.appendChild(dot);
      }

      cell.addEventListener('click', () => this._selectDate(key, list));
      this.gridEl.appendChild(cell);
    }

    // Default detail line.
    if (this.detailEl && !this._selectedDateKey) {
      const totalDays = Object.keys(byDate).length;
      this.detailEl.textContent = totalDays > 0
        ? `${totalDays} workout day${totalDays === 1 ? '' : 's'} this month. Tap a day for details.`
        : 'No workouts this month yet. Tap SPIN to start one.';
    }
  },

  _selectDate(key, list) {
    this._selectedDateKey = key;
    // Re-render to update the selected highlight.
    this._renderCalendar();

    if (!this.detailEl) return;
    if (!list || list.length === 0) {
      this.detailEl.textContent = 'No workouts on this day.';
      return;
    }

    this.detailEl.textContent = '';
    const dateLine = document.createElement('div');
    dateLine.className = 'cal-detail-date';
    const d = new Date(list[0].date || key);
    dateLine.textContent = d.toLocaleDateString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric'
    });
    this.detailEl.appendChild(dateLine);

    list.slice(0, 6).forEach((w) => {
      const row = document.createElement('div');
      row.className = 'cal-detail-row';
      const name = document.createElement('span');
      name.className = 'cal-detail-name';
      name.textContent = w.exerciseName || w.exerciseId || 'Workout';
      const stats = document.createElement('span');
      stats.className = 'cal-detail-stats';
      const sets = w.sets || 0;
      const reps = w.reps || 0;
      const unit = w.unit === 'seconds' ? 's' : '';
      stats.textContent = `${sets}×${reps}${unit} · ${formatDuration(w.duration || 0)}`;
      row.append(name, stats);
      this.detailEl.appendChild(row);
    });

    if (list.length > 6) {
      const more = document.createElement('div');
      more.className = 'cal-detail-more';
      more.textContent = `+ ${list.length - 6} more`;
      this.detailEl.appendChild(more);
    }
  },

  // ── Personal Records ───────────────────────────────────────

  _renderPRs() {
    if (!this.prListEl) return;
    this.prListEl.textContent = '';

    const records = Storage.getPersonalRecords();
    const ids = Object.keys(records);

    if (ids.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'pr-empty';
      empty.textContent = 'Finish a workout to log your first personal record.';
      this.prListEl.appendChild(empty);
      return;
    }

    // Sort by most-recently-broken first, then by total reps as a tiebreaker.
    ids.sort((a, b) => {
      const ta = records[a].lastAchievedAt ? Date.parse(records[a].lastAchievedAt) : 0;
      const tb = records[b].lastAchievedAt ? Date.parse(records[b].lastAchievedAt) : 0;
      if (tb !== ta) return tb - ta;
      return (records[b].totalReps || 0) - (records[a].totalReps || 0);
    });

    for (const id of ids) {
      const pr = records[id];
      const card = document.createElement('div');
      card.className = 'pr-card';

      const head = document.createElement('div');
      head.className = 'pr-head';
      const icon = document.createElement('span');
      icon.className = 'pr-icon';
      icon.textContent = pr.icon || '💪';
      const name = document.createElement('span');
      name.className = 'pr-name';
      name.textContent = pr.exerciseName || id;
      head.append(icon, name);

      const stats = document.createElement('div');
      stats.className = 'pr-stats';
      const unitLabel = pr.unit === 'seconds' ? 's' : '';
      stats.appendChild(this._prStat('Best Set', `${pr.bestPerSet || 0}${unitLabel}`));
      stats.appendChild(this._prStat('Most Reps', `${pr.totalReps || 0}${unitLabel}`));
      stats.appendChild(this._prStat('Most Sets', `${pr.totalSets || 0}`));

      card.append(head, stats);
      this.prListEl.appendChild(card);
    }
  },

  _prStat(label, value) {
    const wrap = document.createElement('div');
    wrap.className = 'pr-stat';
    const v = document.createElement('span');
    v.className = 'pr-stat-value';
    v.textContent = value;
    const l = document.createElement('span');
    l.className = 'pr-stat-label';
    l.textContent = label;
    wrap.append(v, l);
    return wrap;
  }
};
