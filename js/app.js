// ─────────────────────────────────────────────────────────────
// Push-Up Roulette — Main App Controller
// Central orchestrator that wires every module together.
// ─────────────────────────────────────────────────────────────

import { generateChallenge, generateChallengeForExercise, MODES } from './randomizer.js';
import { Roulette } from './roulette.js';
import { Workout } from './workout.js';
import { Storage } from './storage.js';
import { Achievements } from './achievements.js';
import { Audio } from './audio.js';
import { Stats } from './stats.js';
import { Theme } from './theme.js';
import { Group } from './group.js';

// ── Mode mapping (HTML kebab-case → MODES UPPER_SNAKE) ──────
const MODE_MAP = {
  'quick-burn': 'QUICK_BURN',
  'standard':   'STANDARD',
  'warrior':    'WARRIOR',
  'chaos':      'CHAOS',
};

// ── App state ────────────────────────────────────────────────
let currentView       = 'view-main';
let currentChallenge  = null;
let currentMode       = 'STANDARD';
let currentDifficulty = 'all';
let currentCategory   = 'all';
let isGroupHost       = false;
let groupConnected    = false;

// ── DOM refs (populated once on DOMContentLoaded) ────────────
const $ = (id) => document.getElementById(id);

// ── Helpers ──────────────────────────────────────────────────
function formatDuration(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatTimeCompact(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function setMainButtonsDisabled(disabled) {
  $('btn-spin').disabled = disabled;
  $('btn-start').disabled = disabled;
  $('btn-skip').disabled = disabled;
  $('btn-group').disabled = disabled;
}

// ── View Navigation ─────────────────────────────────────────
function showView(viewId) {
  document.querySelectorAll('.view').forEach((el) => el.classList.add('hidden'));
  const target = $(viewId);
  if (target) target.classList.remove('hidden');
  currentView = viewId;
}

// ── Challenge Display ───────────────────────────────────────
function updateChallengeDisplay(challenge) {
  $('challenge-icon').textContent       = challenge.exercise.icon;
  $('challenge-name').textContent       = challenge.exercise.name;

  const diffEl = $('challenge-difficulty');
  diffEl.textContent = challenge.exercise.difficulty.charAt(0).toUpperCase()
                     + challenge.exercise.difficulty.slice(1);
  diffEl.setAttribute('data-difficulty', challenge.exercise.difficulty);

  $('challenge-sets').textContent = challenge.sets;
  $('challenge-reps').textContent = challenge.reps;

  const unit = challenge.unit || 'reps';
  const unitLabel = unit === 'seconds' ? 'sec' : 'reps';
  const statsEl = document.querySelector('.challenge-stats');
  statsEl.innerHTML = `<span id="challenge-sets">${challenge.sets}</span> sets × <span id="challenge-reps">${challenge.reps}</span> ${unitLabel} &nbsp;·&nbsp; work: ${formatTimeCompact(challenge.workTime)} &nbsp;·&nbsp; rest: <span id="challenge-rest">${challenge.rest}s</span>`;
}

// ── Generate a fresh challenge using current settings ───────
function buildChallenge() {
  return generateChallenge({
    mode: currentMode,
    difficulty: currentDifficulty,
    category: currentCategory,
    lastExerciseId: currentChallenge?.exercise?.id,
  });
}

// ── Progress / Stats rendering ──────────────────────────────
function renderProgressView() {
  const stats  = Storage.getLifetimeStats();
  const streak = Storage.getStreak();

  $('stats-total-pushups').textContent  = stats.totalPushups ?? 0;
  $('stats-total-workouts').textContent = stats.totalWorkouts ?? 0;
  $('stats-current-streak').innerHTML   = `${streak.current ?? 0} <span class="streak-fire">🔥</span>`;
  $('stats-longest-streak').textContent = streak.longest ?? 0;

  // Favorite variation
  const workouts = Storage.getWorkouts ? Storage.getWorkouts() : [];
  if (workouts.length) {
    const freq = {};
    workouts.forEach((w) => {
      const name = w.exercise || w.exerciseName || 'Unknown';
      freq[name] = (freq[name] || 0) + 1;
    });
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    $('stats-favorite').textContent = sorted[0][0];
  } else {
    $('stats-favorite').textContent = '—';
  }

  // Render chart via Stats module
  Stats.renderChart();

  // Badges
  renderBadges();
}

function renderBadges() {
  const gallery = $('badge-gallery');
  gallery.innerHTML = '';
  const all = Achievements.getAll();

  all.forEach((a) => {
    const card = document.createElement('div');
    card.className = 'badge' + (a.unlocked ? '' : ' locked');
    card.innerHTML = `
      <span class="badge-icon">${a.icon}</span>
      <span class="badge-name">${a.name}</span>
    `;
    gallery.appendChild(card);
  });
}

// ── Toast system ────────────────────────────────────────────
function showToast(message) {
  const container = $('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('exit');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ── Exercise Preview ────────────────────────────────────────
function showExercisePreview(challenge) {
  const preview = $('exercise-preview');
  const exercise = challenge.exercise;

  // Set illustration image
  const imgEl = $('preview-image');
  if (exercise.illustration) {
    imgEl.src = exercise.illustration;
    imgEl.alt = exercise.name + ' illustration';
  } else {
    imgEl.src = '';
    imgEl.alt = '';
  }

  // Set exercise info
  $('preview-name').textContent = exercise.name;
  $('preview-description').textContent = exercise.description || '';
  $('preview-muscle').textContent = exercise.muscleEmphasis || exercise.category || '';

  const diffEl = $('preview-difficulty');
  diffEl.textContent = exercise.difficulty.charAt(0).toUpperCase() + exercise.difficulty.slice(1);
  diffEl.setAttribute('data-difficulty', exercise.difficulty);

  // Set workout stats
  const unitLabel = challenge.unit === 'seconds' ? 'sec' : 'reps';
  $('preview-sets').textContent = challenge.sets + ' sets × ' + challenge.reps + ' ' + unitLabel;
  $('preview-reps').textContent = 'Work ' + formatTimeCompact(challenge.workTime) + '  ·  Rest ' + formatTimeCompact(challenge.rest);

  // Reset button visibility and text for the normal starting state
  $('btn-begin-workout').classList.remove('hidden');
  $('btn-close-preview').textContent = '← Back';

  // Show the overlay
  preview.classList.remove('hidden');
}

function hideExercisePreview() {
  $('exercise-preview').classList.add('hidden');
}

// ── Group UI helpers ────────────────────────────────────────
function updateGroupMemberList(members) {
  // Lobby list
  const listEl = $('group-members');
  if (listEl) {
    listEl.innerHTML = '';
    members.forEach((m) => {
      const li = document.createElement('li');
      li.className = 'member-item';
      li.textContent = m.name || m;
      listEl.appendChild(li);
    });
  }

  // Count labels
  const count = members.length;
  const countEl = $('group-count');
  if (countEl) countEl.textContent = `${count} member${count !== 1 ? 's' : ''} connected`;

  const badgeCount = $('group-badge-count');
  if (badgeCount) badgeCount.textContent = count;

  // Workout member progress
  const workoutMembers = $('group-workout-members');
  if (workoutMembers && currentView === 'view-workout') {
    const heading = workoutMembers.querySelector('h3') || '';
    workoutMembers.innerHTML = '';
    if (heading) workoutMembers.appendChild(typeof heading === 'string' ? (() => { const h = document.createElement('h3'); h.textContent = 'Group Progress'; return h; })() : heading);
    members.forEach((m) => {
      const card = document.createElement('div');
      card.className = 'member-progress-card';
      card.innerHTML = `<span class="member-name">${m.name || m}</span>
        <span class="member-set">${m.currentSet != null ? `Set ${m.currentSet}` : '—'}</span>`;
      workoutMembers.appendChild(card);
    });
  }
}

function showGroupBadge() {
  const badge = $('group-badge');
  if (badge) badge.classList.remove('hidden');
  groupConnected = true;
}

function hideGroupBadge() {
  const badge = $('group-badge');
  if (badge) badge.classList.add('hidden');
  groupConnected = false;
}

function resetGroupUI() {
  const hostSection = $('group-host-section');
  const joinSection = $('group-join-section');
  if (hostSection) hostSection.classList.add('hidden');
  if (joinSection) joinSection.classList.remove('hidden');
  isGroupHost = false;
  $('roulette-window').classList.remove('locked');
}

// ── Settings persistence ────────────────────────────────────
function savePreferences() {
  Storage.savePreferences({
    difficulty: currentDifficulty,
    category: currentCategory,
    mode: $('setting-mode').value || 'standard',
    sound: $('setting-sound').checked,
    vibration: $('setting-vibration').checked,
    theme: Theme.current ? Theme.current() : (document.documentElement.getAttribute('data-theme') || 'dark'),
  });
}

function loadPreferences() {
  const prefs = Storage.getPreferences();
  if (!prefs) return;

  if (prefs.difficulty) {
    currentDifficulty = prefs.difficulty;
    $('setting-difficulty').value = prefs.difficulty;
  }
  {
    const mode = prefs.mode || 'standard';
    $('setting-mode').value = mode;
    currentMode = MODE_MAP[mode] || 'STANDARD';
  }
  if (prefs.sound !== undefined) {
    $('setting-sound').checked = prefs.sound;
    Audio.setEnabled(prefs.sound);
  }
  if (prefs.vibration !== undefined) {
    $('setting-vibration').checked = prefs.vibration;
  }
  if (prefs.theme) {
    Theme.set ? Theme.set(prefs.theme) : null;
  }
  if (prefs.category) {
    currentCategory = prefs.category;
    $('setting-category').value = prefs.category;
  }
}

// ── Workout completion handler ──────────────────────────────
function handleWorkoutComplete(results) {
  // Persist
  Storage.saveWorkout({ ...results, isGroup: groupConnected });
  Storage.updateLifetimeStats(results.totalPushups, results.duration);
  Storage.updateStreak();

  // Check achievements
  const stats  = Storage.getLifetimeStats();
  const streak = Storage.getStreak();
  const achievementStats = {
    totalPushups:   stats.totalPushups,
    totalWorkouts:  stats.totalWorkouts,
    currentStreak:  streak.current,
    chaosCompleted: currentMode === 'CHAOS',
    eliteCompleted: currentChallenge?.exercise?.difficulty === 'elite',
  };
  Achievements.check(achievementStats);

  // Broadcast if in group
  if (groupConnected) {
    Group.broadcastWorkoutComplete(results);
  }

  // Populate completion view
  $('complete-total-pushups').textContent = results.totalPushups;
  $('complete-total-sets').textContent    = results.sets;
  $('complete-duration').textContent      = formatDuration(Math.round(results.duration));
  $('complete-calories').textContent      = Math.round(results.totalPushups * 0.36);

  showView('view-complete');
}

// ── Boot ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // ── Theme ───────────────────────────────────────────────
  Theme.init();
  $('btn-theme').textContent = Theme.getIcon();

  // ── Preferences ─────────────────────────────────────────
  loadPreferences();

  // ── Roulette ────────────────────────────────────────────
  Roulette.init($('roulette-window'), $('roulette-strip'));

  Roulette.onSelect((exercise) => {
    if (Roulette.isSpinning) return;
    const challenge = generateChallengeForExercise(exercise, {
      mode: currentMode,
    });
    currentChallenge = challenge;
    updateChallengeDisplay(challenge);

    if (groupConnected && isGroupHost) {
      Group.broadcastSpin(challenge);
    }
  });

  // ── Workout ─────────────────────────────────────────────
  Workout.init({
    exerciseEl:     $('workout-exercise'),
    statusEl:       $('workout-status'),
    timerEl:        $('workout-timer'),
    setDisplayEl:   $('workout-set-display'),
    repsDisplayEl:  $('workout-reps-display'),
    workTimeEl:     $('work-time-display'),
    restTimeEl:     $('rest-time-display'),
    progressRing:   $('workout-progress-ring'),
    btnSetComplete: $('btn-set-complete'),
    btnSkipRest:    $('btn-skip-rest'),
  });

  Workout.onComplete(handleWorkoutComplete);

  // ── Stats ───────────────────────────────────────────────
  Stats.init($('stats-chart'));

  // ── Achievements toast ──────────────────────────────────
  Achievements.onUnlock((achievement) => {
    showToast(`${achievement.icon} ${achievement.name} unlocked!`);
  });

  // ── Initial challenge ───────────────────────────────────
  currentChallenge = buildChallenge();
  updateChallengeDisplay(currentChallenge);
  Roulette.alignTo(currentChallenge.exercise);

  // ── Service Worker ──────────────────────────────────────
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  // ───────────────────────────────────────────────────────
  // EVENT LISTENERS
  // ───────────────────────────────────────────────────────

  // ── Spin ────────────────────────────────────────────────
  $('btn-spin').addEventListener('click', async () => {
    Audio.init();
    Audio.buttonPress();

    setMainButtonsDisabled(true);

    const challenge = buildChallenge();
    currentChallenge = challenge;

    await Roulette.spin(challenge.exercise);
    updateChallengeDisplay(challenge);

    setMainButtonsDisabled(false);

    if (groupConnected && isGroupHost) {
      Group.broadcastSpin(challenge);
    }
  });

  // ── Start Workout (show exercise preview first) ─────────
  $('btn-start').addEventListener('click', () => {
    if (!currentChallenge) return;
    Audio.buttonPress();
    showExercisePreview(currentChallenge);
  });

  // ── Exercise Preview: Begin Workout ─────────────────────
  $('btn-begin-workout').addEventListener('click', () => {
    if (!currentChallenge) return;
    Audio.buttonPress();
    hideExercisePreview();
    showView('view-workout');
    Workout.start(currentChallenge);

    if (groupConnected) {
      Group.broadcastWorkoutStart(currentChallenge);
      $('group-workout-members').classList.remove('hidden');
    } else {
      $('group-workout-members').classList.add('hidden');
    }
  });

  // ── Exercise Preview: Back ──────────────────────────────
  $('btn-close-preview').addEventListener('click', () => {
    Audio.buttonPress();
    hideExercisePreview();
  });

  // ── Skip ────────────────────────────────────────────────
  $('btn-skip').addEventListener('click', () => {
    Audio.buttonPress();
    currentChallenge = buildChallenge();
    updateChallengeDisplay(currentChallenge);
    Roulette.alignTo(currentChallenge.exercise);
  });

  // ── Set Complete ────────────────────────────────────────
  $('btn-set-complete').addEventListener('click', () => {
    Audio.buttonPress();
    const setBeforeAdvance = Workout.currentSet;
    Workout.markSetComplete();
    if (groupConnected) {
      Group.broadcastSetComplete(setBeforeAdvance);
    }
  });

  // ── Skip Rest ───────────────────────────────────────────
  $('btn-skip-rest').addEventListener('click', () => {
    Audio.buttonPress();
    Workout.skipRest();
  });

  // ── View Exercise During Workout ───────────────────────
  $('btn-workout-preview').addEventListener('click', () => {
    if (!currentChallenge) return;
    showExercisePreview(currentChallenge);
    // Hide the "LET'S GO" button since workout is already active
    $('btn-begin-workout').classList.add('hidden');
    // Change back button text to "Close"
    $('btn-close-preview').textContent = '✕ Close';
  });

  // ── Work Time Adjustment (+/- 5s) ─────────────────────
  $('btn-work-plus').addEventListener('click', () => {
    Audio.buttonPress();
    const newWork = Workout.adjustWorkTime(5);
    $('work-time-display').textContent = formatTimeCompact(newWork);
    if (groupConnected && isGroupHost) {
      Group.broadcastTimeAdjust('work', 5);
    }
  });

  $('btn-work-minus').addEventListener('click', () => {
    Audio.buttonPress();
    const newWork = Workout.adjustWorkTime(-5);
    $('work-time-display').textContent = formatTimeCompact(newWork);
    if (groupConnected && isGroupHost) {
      Group.broadcastTimeAdjust('work', -5);
    }
  });

  // ── Rest Time Adjustment (+/- 5s) ─────────────────────
  $('btn-rest-plus').addEventListener('click', () => {
    Audio.buttonPress();
    const newRest = Workout.adjustRestTime(5);
    $('rest-time-display').textContent = formatTimeCompact(newRest);
    if (groupConnected && isGroupHost) {
      Group.broadcastTimeAdjust('rest', 5);
    }
  });

  $('btn-rest-minus').addEventListener('click', () => {
    Audio.buttonPress();
    const newRest = Workout.adjustRestTime(-5);
    $('rest-time-display').textContent = formatTimeCompact(newRest);
    if (groupConnected && isGroupHost) {
      Group.broadcastTimeAdjust('rest', -5);
    }
  });

  // ── Toggle Timer Play/Pause ────────────────────────────
  $('btn-toggle-timer').addEventListener('click', () => {
    Audio.buttonPress();
    const isPaused = Workout.togglePause();
    $('btn-toggle-timer').textContent = isPaused ? '▶' : '⏸';
    if (groupConnected && isGroupHost) {
      Group.broadcastPauseToggle(isPaused);
    }
  });

  // ── Workout State Changes ──────────────────────────────
  Workout.onStateChange((state) => {
    const isInitiator = !groupConnected || isGroupHost;
    const toggleBtn = $('btn-toggle-timer');
    if (toggleBtn) {
      toggleBtn.style.display = isInitiator ? 'flex' : 'none';
      toggleBtn.textContent = Workout.isPaused ? '▶' : '⏸';
    }

    // In group mode, only host can adjust times
    const canAdjust = !groupConnected || isGroupHost;
    const timeControls = $('time-controls');
    if (canAdjust) {
      timeControls.style.pointerEvents = 'auto';
      timeControls.style.opacity = '1';
    } else {
      // Members can see times but not adjust
      timeControls.style.pointerEvents = 'none';
      timeControls.style.opacity = '0.6';
    }

    // Restore preview button state
    $('btn-begin-workout').classList.remove('hidden');
    $('btn-close-preview').textContent = '← Back';
  });

  // ── Quit Workout ────────────────────────────────────────
  $('btn-quit-workout').addEventListener('click', () => {
    Workout.destroy();
    showView('view-main');
  });

  // ── Theme Toggle ────────────────────────────────────────
  $('btn-theme').addEventListener('click', () => {
    Theme.toggle();
    $('btn-theme').textContent = Theme.getIcon();
    savePreferences();
  });

  // ── Settings ────────────────────────────────────────────
  $('btn-settings').addEventListener('click', () => showView('view-settings'));

  $('btn-back-settings').addEventListener('click', () => {
    savePreferences();
    showView('view-main');
  });

  // ── Progress ────────────────────────────────────────────
  $('btn-progress').addEventListener('click', () => {
    renderProgressView();
    showView('view-progress');
  });

  $('btn-back-progress').addEventListener('click', () => showView('view-main'));

  // ── Group Lobby ─────────────────────────────────────────
  $('btn-group').addEventListener('click', () => showView('view-group'));

  $('btn-back-group').addEventListener('click', () => {
    if (groupConnected) {
      Group.disconnect();
    }
    hideGroupBadge();
    resetGroupUI();
    showView('view-main');
  });

  // ── Create Group ────────────────────────────────────────
  $('btn-create-group').addEventListener('click', async () => {
    const name = $('group-name-input').value.trim() || 'Host';
    const code = await Group.createSession(name);

    $('group-host-section').classList.remove('hidden');
    $('group-join-section').classList.add('hidden');
    $('group-code').textContent = code;
    isGroupHost = true;

    showGroupBadge();

    // Register member update callback
    Group.onMemberUpdate((members) => updateGroupMemberList(members));
  });

  // ── Join Group ──────────────────────────────────────────
  $('btn-join-group').addEventListener('click', async () => {
    const name = $('group-name-input').value.trim();
    const code = $('group-code-input').value.trim().toUpperCase();

    if (!name || !code) return;

    await Group.joinSession(code, name);
    showGroupBadge();
    showView('view-main');
    $('roulette-window').classList.add('locked');

    // Register group callbacks for non-host
    Group.onSpinReceived(async (data) => {
      setMainButtonsDisabled(true);

      const challenge = {
        exercise: data.exercise,
        sets: data.sets,
        reps: data.reps,
        rest: data.rest,
      };
      currentChallenge = challenge;
      await Roulette.spin(data.exercise);
      updateChallengeDisplay(challenge);

      setMainButtonsDisabled(false);
    });

    Group.onWorkoutStart((data) => {
      currentChallenge = {
        exercise: data.exercise,
        sets: data.sets,
        reps: data.reps,
        rest: data.rest,
      };
      showView('view-workout');
      Workout.start(currentChallenge);
    });

    Group.onMemberUpdate((members) => updateGroupMemberList(members));

    Group.onPauseToggleReceived((isPaused) => {
      if (isPaused !== Workout.isPaused) {
        Workout.togglePause();
      }
    });

    Group.onTimeAdjustReceived((type, delta) => {
      if (type === 'work') {
        const newWork = Workout.adjustWorkTime(delta);
        $('work-time-display').textContent = formatTimeCompact(newWork);
      } else if (type === 'rest') {
        const newRest = Workout.adjustRestTime(delta);
        $('rest-time-display').textContent = formatTimeCompact(newRest);
      }
    });
  });

  // ── Group Spin (host) ──────────────────────────────────
  $('btn-group-spin').addEventListener('click', async () => {
    Audio.init();
    Audio.buttonPress();

    setMainButtonsDisabled(true);

    const challenge = buildChallenge();
    currentChallenge = challenge;

    await Roulette.spin(challenge.exercise);
    updateChallengeDisplay(challenge);

    setMainButtonsDisabled(false);

    Group.broadcastSpin(challenge);
    showView('view-main');
  });

  // ── Completion Actions ─────────────────────────────────
  $('btn-complete-spin').addEventListener('click', () => {
    showView('view-main');
    // Trigger a spin after view transition
    $('btn-spin').click();
  });

  $('btn-save-workout').addEventListener('click', () => {
    showView('view-main');
  });

  // ── Settings change listeners ──────────────────────────
  $('setting-difficulty').addEventListener('change', (e) => {
    currentDifficulty = e.target.value;
    savePreferences();
  });

  $('setting-mode').addEventListener('change', (e) => {
    currentMode = MODE_MAP[e.target.value] || 'STANDARD';
    savePreferences();
  });

  $('setting-sound').addEventListener('change', (e) => {
    Audio.setEnabled(e.target.checked);
    savePreferences();
  });

  $('setting-vibration').addEventListener('change', () => {
    savePreferences();
  });

  $('setting-category').addEventListener('change', (e) => {
    currentCategory = e.target.value;
    savePreferences();
  });

  // ── Submit Feedback ─────────────────────────────────────
  $('btn-submit-feedback').addEventListener('click', () => {
    const feedbackText = $('feedback-input').value.trim();
    if (!feedbackText) {
      showToast('Please enter some feedback first!');
      return;
    }

    Storage.saveFeedback(feedbackText);
    $('feedback-input').value = '';
    showToast('Thank you! Feedback saved locally.');
  });
});
