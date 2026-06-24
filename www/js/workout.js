/**
 * Workout — Guided workout flow engine with timer system.
 *
 * State machine: IDLE → COUNTDOWN → ACTIVE → RESTING → ACTIVE → … → COMPLETE
 *
 * Features:
 *  - 3-2-1-GO countdown before workout begins
 *  - Active timer: count-up for reps, countdown for timed exercises
 *  - Rest countdown with circular progress ring
 *  - Date.now()-based timing that survives background tabs
 *  - Wake Lock API to keep screen alive during workout
 *  - Callback system for state changes and workout completion
 */

import { Audio } from './audio.js';

/* ── state enum ────────────────────────────────────────────────────── */

const STATES = Object.freeze({
  IDLE:      'idle',
  COUNTDOWN: 'countdown',
  ACTIVE:    'active',
  RESTING:   'resting',
  COMPLETE:  'complete'
});

/* ── constants ─────────────────────────────────────────────────────── */

const RING_RADIUS        = 90; // must match SVG <circle r="90">
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const PRE_COUNTDOWN_SECS = 3;  // 3-2-1-GO

/* ── module ────────────────────────────────────────────────────────── */

export const Workout = {
  state:              STATES.IDLE,
  challenge:          null,   // { exercise, reps, sets, rest, workTime, unit }
  currentSet:         0,
  totalSets:          0,
  restTimeRemaining:  0,
  activeTimeRemaining:0,      // seconds remaining during active set
  timerInterval:      null,
  startTime:          null,   // workout overall start time
  setStartTime:       null,   // current set start time
  elapsedTime:        0,
  wakeLock:           null,
  elements:           null,
  countdownRemaining: 0,
  isPaused:           false,

  /** @type {Function[]} */
  _stateCallbacks:    [],
  /** @type {Function[]} */
  _completeCallbacks: [],
  /** Which integer second we last played a tick for */
  _lastTickSecond:    -1,

  /* ── public API ────────────────────────────────────────────────── */

  /**
   * Attach to DOM elements used by the workout view.
   */
  init(elements) {
    this.elements = elements;
    this._setupVisibilityHandler();
  },

  /**
   * Start a workout with the given challenge.
   * Begins with a 3-2-1-GO countdown before the first active set.
   */
  start(challenge) {
    this.challenge  = challenge;
    this.currentSet = 1;
    this.totalSets  = challenge.sets;
    this.startTime  = Date.now();
    this.isPaused   = false;

    this._requestWakeLock();

    // Start with countdown
    this._startPreCountdown();
  },

  /**
   * Mark the current active set as complete.
   * If it's the last set the workout finishes; otherwise rest begins.
   */
  markSetComplete() {
    if (this.state !== STATES.ACTIVE) return;

    // Stop any active timer
    clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.isPaused = false;

    if (this.currentSet >= this.totalSets) {
      this._completeWorkout();
      return;
    }

    // Transition to rest
    this.state = STATES.RESTING;
    this.restTimeRemaining = this.challenge.rest;
    this._lastTickSecond = -1;
    this._startRestTimer();
    this._updateDisplay();
    this._notifyStateChange();
  },

  /**
   * Toggle the pause state of the timer.
   * @returns {boolean} — the new pause state
   */
  togglePause() {
    if (this.state === STATES.IDLE || this.state === STATES.COMPLETE) return false;

    if (this.isPaused) {
      // Resume
      this.isPaused = false;

      if (this.state === STATES.COUNTDOWN) {
        this._startPreCountdown(true);
      } else if (this.state === STATES.ACTIVE) {
        this._startActiveTimer();
      } else if (this.state === STATES.RESTING) {
        this._startRestTimer();
      }

      this._updateDisplay();
      this._notifyStateChange();
    } else {
      // Pause
      this.isPaused = true;
      clearInterval(this.timerInterval);
      this.timerInterval = null;

      this._updateDisplay();
      this._notifyStateChange();
    }

    return this.isPaused;
  },

  /**
   * Skip the current rest countdown and advance immediately.
   */
  skipRest() {
    if (this.state !== STATES.RESTING) return;
    clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.isPaused = false;
    this._advanceToNextSet();
  },

  /**
   * Adjust the rest time by delta seconds (positive or negative).
   * Affects both the current countdown and future rest periods.
   * @param {number} delta — seconds to add (e.g. +5 or -5)
   * @returns {number} — the new rest duration for display
   */
  adjustRestTime(delta) {
    this.challenge.rest = Math.max(5, Math.min(300, this.challenge.rest + delta));

    if (this.state === STATES.RESTING) {
      this.restTimeRemaining = Math.max(0, this.restTimeRemaining + delta);
      this._updateTimerDisplay(Math.ceil(this.restTimeRemaining));
      this._updateProgressRing(this.restTimeRemaining / this.challenge.rest);
    }

    return this.challenge.rest;
  },

  /**
   * Adjust the work time by delta seconds (positive or negative).
   * Affects both the current active countdown and future sets.
   * @param {number} delta — seconds to add (e.g. +5 or -5)
   * @returns {number} — the new work time for display
   */
  adjustWorkTime(delta) {
    this.challenge.workTime = Math.max(10, Math.min(300, this.challenge.workTime + delta));

    if (this.state === STATES.ACTIVE) {
      this.activeTimeRemaining = Math.max(0, this.activeTimeRemaining + delta);
      this._updateTimerDisplay(this._formatTime(Math.ceil(this.activeTimeRemaining)));
      this._updateProgressRing(this.activeTimeRemaining / this.challenge.workTime);
    }

    return this.challenge.workTime;
  },

  /**
   * Get a snapshot of the current workout state.
   */
  getCurrentState() {
    return {
      state:             this.state,
      currentSet:        this.currentSet,
      totalSets:         this.totalSets,
      restTimeRemaining: this.restTimeRemaining,
      isPaused:          this.isPaused
    };
  },

  /**
   * Clean up timers and release wake lock.
   */
  destroy() {
    clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.isPaused = false;
    this._releaseWakeLock();
    this.state = STATES.IDLE;
  },

  /* ── callbacks ─────────────────────────────────────────────────── */

  onStateChange(callback) { this._stateCallbacks.push(callback); },
  onComplete(callback)    { this._completeCallbacks.push(callback); },

  /* ── internal: pre-workout countdown (3-2-1-GO) ────────────────── */

  _startPreCountdown(isResume = false) {
    this.state = STATES.COUNTDOWN;
    if (!isResume) {
      this.countdownRemaining = PRE_COUNTDOWN_SECS;
    }
    this._updateDisplay();
    this._notifyStateChange();

    Audio.timerTick();
    this._updateTimerDisplay(this.countdownRemaining);
    this._updateProgressRing(this.countdownRemaining / PRE_COUNTDOWN_SECS);

    this.timerInterval = setInterval(() => {
      this.countdownRemaining--;

      if (this.countdownRemaining <= 0) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;

        // Flash "GO!" briefly then transition to active
        this._updateTimerDisplay('GO!');
        this._updateProgressRing(0);
        Audio.restComplete(); // triumphant sound

        setTimeout(() => {
          this._enterActiveState();
        }, 600);
        return;
      }

      Audio.timerTick();
      this._updateTimerDisplay(this.countdownRemaining);
      this._updateProgressRing(this.countdownRemaining / PRE_COUNTDOWN_SECS);
    }, 1000);
  },

  /* ── internal: active state with timer ──────────────────────────── */

  _enterActiveState() {
    this.state = STATES.ACTIVE;
    this.setStartTime = Date.now();
    this.activeTimeRemaining = this.challenge.workTime;
    this._lastTickSecond = -1;
    this._updateDisplay();
    this._notifyStateChange();
    this._startActiveTimer();
  },

  /**
   * All exercises use a countdown work timer.
   * When it hits zero: auto-advance to rest or complete.
   * User can also press "Set Complete" early.
   */
  _startActiveTimer() {
    this._updateTimerDisplay(this._formatTime(Math.ceil(this.activeTimeRemaining)));
    this._updateProgressRing(this.activeTimeRemaining / this.challenge.workTime);

    let lastTimestamp = Date.now();

    this.timerInterval = setInterval(() => {
      const now   = Date.now();
      const delta = (now - lastTimestamp) / 1000;
      lastTimestamp = now;

      this.activeTimeRemaining -= delta;

      if (this.activeTimeRemaining <= 0) {
        this.activeTimeRemaining = 0;
        clearInterval(this.timerInterval);
        this.timerInterval = null;

        // Time's up — auto-complete the set
        Audio.restComplete();
        Audio.vibrate([200, 100, 200]);
        this._updateTimerDisplay('0:00');
        this._updateProgressRing(0);

        setTimeout(() => {
          if (this.currentSet >= this.totalSets) {
            this._completeWorkout();
          } else {
            this.state = STATES.RESTING;
            this.restTimeRemaining = this.challenge.rest;
            this._lastTickSecond = -1;
            this._startRestTimer();
            this._updateDisplay();
            this._notifyStateChange();
          }
        }, 500);
        return;
      }

      // Countdown ticks for last 3 seconds
      const ceilSec = Math.ceil(this.activeTimeRemaining);
      if (ceilSec <= 3 && ceilSec !== this._lastTickSecond) {
        this._lastTickSecond = ceilSec;
        Audio.timerTick();
      }

      this._updateTimerDisplay(this._formatTime(Math.ceil(this.activeTimeRemaining)));
      this._updateProgressRing(this.activeTimeRemaining / this.challenge.workTime);
    }, 100);
  },

  /* ── internal: rest timer ──────────────────────────────────────── */

  _startRestTimer() {
    let lastTimestamp = Date.now();

    this._updateTimerDisplay(Math.ceil(this.restTimeRemaining));
    this._updateProgressRing(this.restTimeRemaining / this.challenge.rest);

    this.timerInterval = setInterval(() => {
      const now   = Date.now();
      const delta = (now - lastTimestamp) / 1000;
      lastTimestamp = now;

      this.restTimeRemaining -= delta;

      if (this.restTimeRemaining <= 0) {
        this.restTimeRemaining = 0;
        clearInterval(this.timerInterval);
        this.timerInterval = null;

        Audio.restComplete();
        Audio.vibrate([200, 100, 200]);

        this._advanceToNextSet();
        return;
      }

      // Countdown ticks for the last 3 seconds
      const ceilSec = Math.ceil(this.restTimeRemaining);
      if (ceilSec <= 3 && ceilSec !== this._lastTickSecond) {
        this._lastTickSecond = ceilSec;
        Audio.timerTick();
      }

      this._updateTimerDisplay(ceilSec);
      this._updateProgressRing(this.restTimeRemaining / this.challenge.rest);
    }, 100);
  },

  /* ── internal: state transitions ───────────────────────────────── */

  _advanceToNextSet() {
    this.currentSet++;
    this._lastTickSecond = -1;
    this._enterActiveState();
  },

  _completeWorkout() {
    this.state       = STATES.COMPLETE;
    this.elapsedTime = Math.floor((Date.now() - this.startTime) / 1000);

    clearInterval(this.timerInterval);
    this.timerInterval = null;
    this._releaseWakeLock();

    Audio.workoutComplete();
    Audio.vibrate([200, 100, 200, 100, 400]);

    const results = {
      exerciseId:    this.challenge.exercise.id,
      exerciseName:  this.challenge.exercise.name,
      reps:          this.challenge.reps,
      sets:          this.challenge.sets,
      rest:          this.challenge.rest,
      totalPushups:  this.challenge.reps * this.challenge.sets,
      duration:      this.elapsedTime,
      date:          new Date().toISOString()
    };

    this._notifyComplete(results);
  },

  /* ── internal: DOM updates ─────────────────────────────────────── */

  _updateDisplay() {
    if (!this.elements) return;

    const {
      exerciseEl, statusEl, setDisplayEl, repsDisplayEl,
      workTimeEl, restTimeEl, btnSetComplete, btnSkipRest
    } = this.elements;

    exerciseEl.textContent    = this.challenge.exercise.name;
    setDisplayEl.textContent  = `${this.currentSet} / ${this.totalSets}`;

    const unitLabel = this.challenge.unit === 'seconds' ? 'sec' : '';
    repsDisplayEl.textContent = this.challenge.reps + (unitLabel ? 's' : '');

    workTimeEl.textContent = this._formatTime(this.challenge.workTime);
    restTimeEl.textContent = this._formatTime(this.challenge.rest);

    const isResting   = this.state === STATES.RESTING;
    const isCountdown = this.state === STATES.COUNTDOWN;
    const isActive    = this.state === STATES.ACTIVE;

    // Status label
    if (this.isPaused) {
      statusEl.textContent = 'PAUSED';
      statusEl.className   = 'workout-status paused';
    } else if (isCountdown) {
      statusEl.textContent = 'GET READY';
      statusEl.className   = 'workout-status rest';
    } else if (isResting) {
      statusEl.textContent = 'REST';
      statusEl.className   = 'workout-status rest';
    } else {
      statusEl.textContent = 'PUSH IT!';
      statusEl.className   = 'workout-status active';
    }

    btnSetComplete.classList.toggle('hidden', !isActive);
    btnSkipRest.classList.toggle('hidden', !isResting);
  },

  _updateTimerDisplay(value) {
    if (this.elements && this.elements.timerEl) {
      this.elements.timerEl.textContent = value;
    }
  },

  _updateProgressRing(progress) {
    if (!this.elements || !this.elements.progressRing) return;
    const circle = this.elements.progressRing.querySelector('.progress-ring-fill');
    if (!circle) return;
    circle.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - progress);
  },

  /* ── internal: format time ─────────────────────────────────────── */

  _formatTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  },

  /* ── internal: visibility handler ──────────────────────────────── */

  _setupVisibilityHandler() {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.state === STATES.RESTING) {
        this._updateTimerDisplay(Math.ceil(this.restTimeRemaining));
        const totalRest = this.challenge ? this.challenge.rest : 1;
        this._updateProgressRing(this.restTimeRemaining / totalRest);
      }
      if (!document.hidden && this.state === STATES.ACTIVE) {
        this._updateTimerDisplay(this._formatTime(Math.ceil(this.activeTimeRemaining)));
        this._updateProgressRing(this.activeTimeRemaining / (this.challenge?.workTime || 1));
      }
    });
  },

  /* ── internal: Wake Lock ───────────────────────────────────────── */

  async _requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        this.wakeLock = await navigator.wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => { this.wakeLock = null; });
        document.addEventListener('visibilitychange', this._reacquireWakeLock);
      }
    } catch (_) {
      /* Wake lock not supported or denied — non-fatal */
    }
  },

  _reacquireWakeLock: async function () {
    if (
      document.visibilityState === 'visible' &&
      Workout.state !== STATES.IDLE &&
      Workout.state !== STATES.COMPLETE &&
      !Workout.wakeLock
    ) {
      try {
        Workout.wakeLock = await navigator.wakeLock.request('screen');
      } catch (_) { /* ignore */ }
    }
  },

  _releaseWakeLock() {
    document.removeEventListener('visibilitychange', this._reacquireWakeLock);
    if (this.wakeLock) {
      this.wakeLock.release();
      this.wakeLock = null;
    }
  },

  /* ── internal: notifications ───────────────────────────────────── */

  _notifyStateChange() {
    this._stateCallbacks.forEach(cb => cb(this.state, this.currentSet, this.totalSets));
  },

  _notifyComplete(results) {
    this._completeCallbacks.forEach(cb => cb(results));
  }
};
