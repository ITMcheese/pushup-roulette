// ─────────────────────────────────────────────────────────────
// Calisthenics Roulette — Main App Controller
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
import { Progress } from './progress.js';
import { ShareCard } from './shareCard.js';
import { Notifications } from './notifications.js';

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

  const unit = challenge.unit || 'reps';
  const unitLabel = unit === 'seconds' ? 'sec' : 'reps';
  const statsEl = document.querySelector('.challenge-stats');
  statsEl.textContent = '';
  const setsSpan = document.createElement('span');
  setsSpan.id = 'challenge-sets';
  setsSpan.textContent = challenge.sets;
  const repsSpan = document.createElement('span');
  repsSpan.id = 'challenge-reps';
  repsSpan.textContent = challenge.reps;
  const restSpan = document.createElement('span');
  restSpan.id = 'challenge-rest';
  restSpan.textContent = challenge.rest + 's';
  // Members of older-version hosts may not receive workTime - show the
  // stats without the work readout instead of rendering "NaN:NaN".
  if (challenge.workTime > 0) {
    statsEl.append(setsSpan, ` sets × `, repsSpan, ` ${unitLabel}  ·  work: ${formatTimeCompact(challenge.workTime)}  ·  rest: `, restSpan);
  } else {
    statsEl.append(setsSpan, ` sets × `, repsSpan, ` ${unitLabel}  ·  rest: `, restSpan);
  }
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
  const streakEl = $('stats-current-streak');
  streakEl.textContent = '';
  streakEl.append(String(streak.current ?? 0) + ' ');
  const fireSpan = document.createElement('span');
  fireSpan.className = 'streak-fire';
  fireSpan.textContent = '\u{1F525}';
  streakEl.appendChild(fireSpan);
  $('stats-longest-streak').textContent = streak.longest ?? 0;

  // Favorite variation
  $('stats-favorite').textContent = Storage.getFavoriteExercise() || '—';

  // Render chart via Stats module
  Stats.renderChart();

  // Calendar + personal records
  Progress.render();

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
    const iconSpan = document.createElement('span');
    iconSpan.className = 'badge-icon';
    iconSpan.textContent = a.icon;
    const nameSpan = document.createElement('span');
    nameSpan.className = 'badge-name';
    nameSpan.textContent = a.name;
    card.append(iconSpan, nameSpan);
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

// ── Tutorial / How it works ─────────────────────────────────
// Each step highlights a real on-screen button and points a tooltip at it.
const TUTORIAL_STEPS = [
  { target: 'btn-spin',     title: 'Welcome! Start by spinning', body: 'Tap <b>🎰 SPIN</b> to land on a random exercise.' },
  { target: 'btn-start',    title: 'Start your workout',         body: 'Hit <b>▶ Start Workout</b> to begin the timed sets. Inside you get a countdown with <b>±5s</b>, <b>pause</b>, and a <b>📖</b> to watch the exercise (tap the GIF to expand it).' },
  { target: 'btn-settings', title: 'Difficulty & sound',         body: 'Open <b>⚙️ Settings</b> to change <b>Difficulty</b>, <b>Focus</b> and <b>Mode</b>, and to turn <b>Sound</b> and <b>Vibration</b> on or off.' },
  { target: 'btn-group',    title: 'Work out with friends',      body: '<b>Create</b> a group to get a code to share, or <b>Join</b> with a friend\'s code — then everyone spins together.' },
  { target: 'btn-progress', title: 'Track your progress',        body: 'See your total reps, workouts, streaks and unlocked achievements.' },
  { target: 'btn-help',     title: 'That\'s it!',                body: 'Reopen this tour anytime from the <b>❓</b> button. Now go spin! 💪' }
];
let tutorialStep = 0;
let _coachResizeBound = false;

function renderTutorialStep() {
  const step = TUTORIAL_STEPS[tutorialStep];
  const target = $(step.target);
  if (!target) { closeTutorial(); return; }

  // Skip steps whose target is hidden (e.g. spin/start are display:none for
  // group members) — otherwise the spotlight lands on an empty 0×0 rect.
  const rect = target.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    if (tutorialStep < TUTORIAL_STEPS.length - 1) {
      tutorialStep++;
      renderTutorialStep();
    } else {
      closeTutorial();
    }
    return;
  }

  $('tutorial-overlay').classList.remove('hidden');
  $('tutorial-title').textContent = step.title;
  $('tutorial-body').innerHTML = step.body; // static, trusted copy

  const dots = $('tutorial-dots');
  dots.innerHTML = '';
  TUTORIAL_STEPS.forEach((_, i) => {
    const dot = document.createElement('span');
    dot.className = 'tutorial-dot' + (i === tutorialStep ? ' active' : '');
    dots.appendChild(dot);
  });
  $('btn-tutorial-back').style.visibility = tutorialStep === 0 ? 'hidden' : 'visible';
  $('btn-tutorial-next').textContent =
    tutorialStep === TUTORIAL_STEPS.length - 1 ? 'Got it! 💪' : 'Next →';

  positionTutorial(target);
}

// Move the spotlight over the target button and point the tooltip at it.
function positionTutorial(target) {
  const r = target.getBoundingClientRect();
  const pad = 8;
  const spot = $('tutorial-spotlight');
  spot.style.left = (r.left - pad) + 'px';
  spot.style.top = (r.top - pad) + 'px';
  spot.style.width = (r.width + pad * 2) + 'px';
  spot.style.height = (r.height + pad * 2) + 'px';

  const tip = $('tutorial-card');
  const arrow = $('tutorial-arrow');
  const vw = window.innerWidth, vh = window.innerHeight;
  const margin = 12, gap = 16;
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  const targetCenterX = r.left + r.width / 2;
  const placeBelow = r.top < vh * 0.45; // target near the top → tooltip below it

  let top = placeBelow ? (r.bottom + gap) : (r.top - gap - th);
  top = Math.max(margin, Math.min(top, vh - margin - th));
  let left = targetCenterX - tw / 2;
  left = Math.max(margin, Math.min(left, vw - margin - tw));
  tip.style.left = left + 'px';
  tip.style.top = top + 'px';

  arrow.className = 'tutorial-arrow ' + (placeBelow ? 'up' : 'down');
  let arrowLeft = targetCenterX - left - 7;
  arrowLeft = Math.max(16, Math.min(arrowLeft, tw - 30));
  arrow.style.left = arrowLeft + 'px';
}

function openTutorial() {
  tutorialStep = 0;
  if (!_coachResizeBound) {
    _coachResizeBound = true;
    window.addEventListener('resize', () => {
      if (!$('tutorial-overlay').classList.contains('hidden')) renderTutorialStep();
    });
  }
  renderTutorialStep();
  // Reposition once web fonts finish loading (button sizes can shift).
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      if (!$('tutorial-overlay').classList.contains('hidden')) renderTutorialStep();
    });
  }
}

function closeTutorial() {
  $('tutorial-overlay').classList.add('hidden');
  try { localStorage.setItem('cr_tutorial_seen', '1'); } catch (e) { /* ignore */ }
}

// ── Connection-status banner (shown in the group lobby) ────
const CONN_STATE_COPY = {
  idle:       { label: 'Idle',                              cls: 'conn-idle' },
  signaling:  { label: 'Reaching signaling server…',         cls: 'conn-pending' },
  connecting: { label: 'Negotiating peer-to-peer link…',     cls: 'conn-pending' },
  checking:   { label: 'Negotiating peer-to-peer link…',     cls: 'conn-pending' },
  connected:  { label: 'Connected!',                         cls: 'conn-ok' },
  completed:  { label: 'Connected!',                         cls: 'conn-ok' },
  disconnected:{label: 'Link dropped — trying to recover…', cls: 'conn-warn' },
  failed:     { label: 'Couldn\'t connect. Try same WiFi.', cls: 'conn-err' },
  closed:     { label: 'Disconnected.',                      cls: 'conn-idle' },
};

function showConnectionStatus(info) {
  const banner = $('group-connection-status');
  const text   = $('connection-status-text');
  const dot    = $('connection-status-dot');
  if (!banner || !text || !dot) return;

  const meta = CONN_STATE_COPY[info.state] || { label: info.state, cls: 'conn-idle' };
  banner.classList.remove('hidden', 'conn-idle', 'conn-pending', 'conn-ok', 'conn-warn', 'conn-err');
  banner.classList.add(meta.cls);
  if (info.state === 'connected' || info.state === 'completed') {
    const pathLabel = info.path === 'relay' ? ' (via relay)'
                    : info.path === 'direct' ? ' (direct)'
                    : '';
    text.textContent = meta.label + pathLabel;
  } else {
    text.textContent = meta.label;
  }
  dot.className = 'connection-dot ' + meta.cls;
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
    workoutMembers.textContent = '';
    if (heading) workoutMembers.appendChild(typeof heading === 'string' ? (() => { const h = document.createElement('h3'); h.textContent = 'Group Progress'; return h; })() : heading);
    members.forEach((m) => {
      const card = document.createElement('div');
      card.className = 'member-progress-card';
      const nameSpan = document.createElement('span');
      nameSpan.className = 'member-name';
      nameSpan.textContent = m.name || m;
      const setSpan = document.createElement('span');
      setSpan.className = 'member-set';
      setSpan.textContent = m.currentSet != null ? `Set ${m.currentSet}` : '—';
      card.append(nameSpan, setSpan);
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

// Toggle role-based control visibility. Members follow the host: they
// can't spin, start, skip, cancel, advance, or scroll the reel.
function updateGroupControls() {
  document.body.classList.toggle('group-connected', groupConnected);
  document.body.classList.toggle('group-member', groupConnected && !isGroupHost);
  $('roulette-window').classList.toggle('locked', groupConnected && !isGroupHost);
}

// ── Settings persistence ────────────────────────────────────
function savePreferences() {
  Storage.savePreferences({
    difficulty: currentDifficulty,
    category: currentCategory,
    mode: $('setting-mode').value || 'standard',
    sound: $('setting-sound').checked,
    vibration: $('setting-vibration').checked,
    reminderEnabled: $('setting-reminder').checked,
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
  if (prefs.reminderEnabled !== undefined) {
    $('setting-reminder').checked = !!prefs.reminderEnabled;
  }
  // Hide the reminder row on platforms where notifications can't actually
  // fire (i.e. the dev preview). Native iOS users still see + toggle it.
  if (!Notifications.isAvailable()) {
    const row = $('setting-reminder')?.closest('.setting-row');
    if (row) row.classList.add('reminder-row-disabled');
  }
}

// ── Last-workout cache (used by the share card) ─────────────
let lastCompletedWorkout = null;
let lastWorkoutBrokeRecord = false;

// ── Workout completion handler ──────────────────────────────
function handleWorkoutComplete(results) {
  // Enrich the saved record with the exercise icon + unit so PRs and the
  // share card can render without a roundtrip to the catalog.
  const enriched = {
    ...results,
    isGroup: groupConnected,
    icon: currentChallenge?.exercise?.icon,
    unit: currentChallenge?.unit || results.unit || 'reps',
    difficulty: currentChallenge?.exercise?.difficulty || 'intermediate'
  };

  // Persist
  Storage.saveWorkout(enriched);
  Storage.updateLifetimeStats(results.totalPushups, results.duration);
  Storage.updateStreak();

  // Personal records — fire a toast for each broken record.
  const brokenRecords = Storage.updatePersonalRecords(enriched);
  brokenRecords.forEach((r) => {
    const kindLabel = r.kind === 'bestPerSet' ? 'Best set'
                    : r.kind === 'totalReps'  ? 'Most total reps'
                    : r.kind === 'totalSets'  ? 'Most sets'
                    : 'Personal record';
    const unit = r.unit === 'seconds' ? 's' : '';
    showToast(`🏆 ${kindLabel}: ${r.current}${unit} — ${r.exerciseName}`);
  });

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

  // Populate completion view (labels + calories are unit-aware: timed holds
  // report seconds, not "reps", and use an isometric-hold calorie estimate).
  const isTimed = enriched.unit === 'seconds';
  $('complete-total-pushups').textContent = results.totalPushups;
  $('complete-reps-label').textContent    = isTimed ? 'Total Seconds' : 'Total Reps';
  $('complete-total-sets').textContent    = results.sets;
  $('complete-duration').textContent      = formatDuration(Math.round(results.duration));
  // ~0.36 kcal per rep; isometric holds ~0.07 kcal per second held.
  $('complete-calories').textContent      = Math.max(1, Math.round(results.totalPushups * (isTimed ? 0.07 : 0.36)));

  // Group results: who finished, how many sets everyone got through.
  const groupResults = $('group-results');
  if (groupConnected) {
    groupResults.classList.remove('hidden');
    // Keep the heading, rebuild the rows.
    groupResults.textContent = '';
    const h = document.createElement('h3');
    h.textContent = 'Group Results';
    groupResults.appendChild(h);
    Group.getMembers().forEach((m) => {
      const row = document.createElement('div');
      row.className = 'group-result-row';
      const name = document.createElement('span');
      name.className = 'group-result-name';
      name.textContent = m.name + (m.isHost ? ' (host)' : '');
      const status = document.createElement('span');
      status.className = 'group-result-status';
      status.textContent = m.isFinished ? '✅ Finished'
                        : m.setsCompleted > 0 ? `Set ${m.setsCompleted}`
                        : 'In progress';
      row.append(name, status);
      groupResults.appendChild(row);
    });
  } else {
    groupResults.classList.add('hidden');
  }

  // Cache for the Share button.
  lastCompletedWorkout = { ...enriched, streak: streak.current };
  lastWorkoutBrokeRecord = brokenRecords.length > 0;

  // Streak kept — replace today's reminder with a single nudge tomorrow.
  const prefs = Storage.getPreferences();
  if (prefs.reminderEnabled && Notifications.isAvailable()) {
    Notifications.onWorkoutLogged(prefs.reminderHour, prefs.reminderMinute);
  }

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
    repsLabelEl:    $('workout-reps-label'),
    workTimeEl:     $('work-time-display'),
    restTimeEl:     $('rest-time-display'),
    progressRing:   $('workout-progress-ring'),
    btnSetComplete: $('btn-set-complete'),
    btnSkipRest:    $('btn-skip-rest'),
  });

  Workout.onComplete(handleWorkoutComplete);

  // ── Stats ───────────────────────────────────────────────
  Stats.init($('stats-chart'));

  // ── Progress (calendar + personal records) ──────────────
  Progress.init({
    gridEl:   $('calendar-grid'),
    titleEl:  $('calendar-title'),
    detailEl: $('calendar-detail'),
    prevBtn:  $('btn-cal-prev'),
    nextBtn:  $('btn-cal-next'),
    prListEl: $('pr-list')
  });

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

  // ── Daily reminder bootstrap ────────────────────────────
  // If the user has reminders on, make sure the schedule is alive (e.g.
  // after a reboot or app reinstall). If they already trained today, arm a
  // single nudge for tomorrow instead so we never ping for a kept streak.
  (async () => {
    const prefs = Storage.getPreferences();
    if (!prefs.reminderEnabled || !Notifications.isAvailable()) return;
    const status = await Notifications.getPermissionStatus();
    if (status !== 'granted') return;

    const streak = Storage.getStreak();
    const workedOutToday = (() => {
      if (!streak.lastWorkoutDate) return false;
      const last = new Date(streak.lastWorkoutDate);
      const now = new Date();
      return last.getFullYear() === now.getFullYear()
          && last.getMonth() === now.getMonth()
          && last.getDate() === now.getDate();
    })();

    if (workedOutToday) {
      Notifications.scheduleOneShotTomorrow(prefs.reminderHour, prefs.reminderMinute);
    } else {
      Notifications.scheduleDaily(prefs.reminderHour, prefs.reminderMinute);
    }
  })();

  // ── Unlock audio on the first user interaction (iOS WKWebView) ──
  let _audioUnlocked = false;
  const unlockAudioOnce = () => {
    if (_audioUnlocked) return;
    _audioUnlocked = true;
    Audio.init();
  };
  document.addEventListener('pointerdown', unlockAudioOnce, { once: true });
  document.addEventListener('touchstart', unlockAudioOnce, { once: true });

  // ── Tutorial / How it works ─────────────────────────────
  $('btn-help').addEventListener('click', () => { Audio.buttonPress(); openTutorial(); });
  $('btn-tutorial-skip').addEventListener('click', closeTutorial);
  $('btn-tutorial-back').addEventListener('click', () => {
    if (tutorialStep > 0) { tutorialStep--; renderTutorialStep(); }
  });
  $('btn-tutorial-next').addEventListener('click', () => {
    if (tutorialStep < TUTORIAL_STEPS.length - 1) { tutorialStep++; renderTutorialStep(); }
    else { closeTutorial(); }
  });
  // Auto-show the tour on first launch
  try {
    if (!localStorage.getItem('cr_tutorial_seen')) openTutorial();
  } catch (e) { /* ignore */ }

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

  // ── Exercise Preview: Expand GIF to full size ───────────
  const openGifLightbox = () => {
    const src = $('preview-image').getAttribute('src');
    if (!src) return;
    Audio.buttonPress();
    $('gif-lightbox-image').src = src;
    $('gif-lightbox').classList.remove('hidden');
  };
  const closeGifLightbox = () => {
    $('gif-lightbox').classList.add('hidden');
    $('gif-lightbox-image').src = '';
  };
  $('btn-expand-gif').addEventListener('click', (e) => { e.stopPropagation(); openGifLightbox(); });
  $('preview-image').addEventListener('click', openGifLightbox);
  // Tap anywhere on the lightbox (backdrop, image, or ✕) closes it
  $('gif-lightbox').addEventListener('click', closeGifLightbox);

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

  // Back from the lobby NAVIGATES ONLY — it must not tear down the session.
  // (Previously a host who tapped ← after creating a group silently killed
  // it for every member. Leaving is explicit via the Leave Group button.)
  $('btn-back-group').addEventListener('click', () => {
    showView('view-main');
  });

  // ── Leave Group (button on the main screen) ─────────────
  $('btn-leave-group').addEventListener('click', () => {
    Audio.buttonPress();
    Group.disconnect();
    hideGroupBadge();
    resetGroupUI();
    updateGroupControls();
    showToast('You left the group.');
    showView('view-main');
  });

  // ── Create Group ────────────────────────────────────────
  $('btn-create-group').addEventListener('click', async () => {
    if (Group.isConnected()) Group.disconnect();   // start from a clean slate
    const name = $('group-name-input').value.trim() || 'Host';
    Group.onConnectionState(showConnectionStatus);
    showConnectionStatus({ state: 'signaling' });
    try {
      const code = await Group.createSession(name);
      showConnectionStatus({ state: 'connected', path: 'direct' });
      $('group-host-section').classList.remove('hidden');
      $('group-join-section').classList.add('hidden');
      $('group-code').textContent = code;
      isGroupHost = true;
      showGroupBadge();
      updateGroupControls();
      Group.onMemberUpdate((members) => updateGroupMemberList(members));
    } catch (err) {
      showConnectionStatus({ state: 'failed' });
      showToast('Could not create the group. Please try again.');
    }
  });

  // ── Join Group ──────────────────────────────────────────
  $('btn-join-group').addEventListener('click', async () => {
    const name = $('group-name-input').value.trim();
    const code = $('group-code-input').value.trim().toUpperCase();

    if (!name || !code) { showToast('Enter your name and a group code.'); return; }

    if (Group.isConnected()) Group.disconnect();   // leave any previous session first

    Group.onConnectionState(showConnectionStatus);

    // Register ALL member callbacks BEFORE joining. The host broadcasts the
    // member list the instant our connection opens — registering after the
    // join resolved meant that first message was silently dropped and the
    // badge showed "0 members" until the next join/leave.
    Group.onSpinReceived(async (data) => {
      setMainButtonsDisabled(true);

      // Preserve the host's full timing (workTime/unit) so this member runs
      // the exact same workout. Fallbacks cover an older-version host.
      const challenge = {
        exercise: data.exercise,
        sets: data.sets,
        reps: data.reps,
        rest: data.rest,
        unit: data.unit || data.exercise?.unit || 'reps',
        workTime: data.workTime,
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
        unit: data.unit || data.exercise?.unit || 'reps',
        workTime: data.workTime,
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

    // If the host vanishes (app closed, network drop), restore solo controls
    // so this member isn't stranded with every button hidden.
    Group.onHostDisconnect(() => {
      Group.disconnect();
      hideGroupBadge();
      resetGroupUI();
      updateGroupControls();
      showToast('Host disconnected — continuing solo.');
    });

    const joinBtn = $('btn-join-group');
    const joinLabel = joinBtn.textContent;
    joinBtn.disabled = true;
    joinBtn.textContent = 'Joining…';
    try {
      await Group.joinSession(code, name);
    } catch (err) {
      joinBtn.disabled = false;
      joinBtn.textContent = joinLabel;
      const msg = String(err?.message || '').toLowerCase().includes('timed out')
        ? 'Took too long. Try the same WiFi, or run the Test Connection check.'
        : 'Could not join — check the code and try again.';
      showToast(msg);
      return;
    }
    joinBtn.disabled = false;
    joinBtn.textContent = joinLabel;

    isGroupHost = false;
    showGroupBadge();
    updateGroupControls();
    showView('view-main');
  });

  // ── Test Connection (diagnostic) ───────────────────────
  $('btn-test-connection').addEventListener('click', async () => {
    Audio.buttonPress();
    const resultsEl = $('connection-test-results');
    const btn = $('btn-test-connection');
    btn.disabled = true;
    btn.textContent = 'Testing…';
    resultsEl.textContent = '';
    try {
      const r = await Group.testConnection();
      const row = (icon, label, ok, hint) => {
        const d = document.createElement('div');
        d.className = 'conn-test-row ' + (ok ? 'conn-ok' : 'conn-warn');
        d.textContent = `${icon} ${label}: ${ok ? 'OK' : (hint || 'unavailable')}`;
        return d;
      };
      resultsEl.appendChild(row('🛰️', 'Signaling server', r.signaling,
        'Cannot reach the matchmaker server. Check your internet.'));
      resultsEl.appendChild(row('🌐', 'STUN (same-WiFi reach)', r.stun,
        'STUN servers unreachable. Same-WiFi groups will still try.'));
      resultsEl.appendChild(row('🔁', 'TURN (cellular fallback)', r.turn,
        'Free TURN is unreachable. Cellular groups won\'t connect reliably.'));
      if (r.error) {
        const e = document.createElement('div');
        e.className = 'conn-test-row conn-err';
        e.textContent = '⚠️ ' + r.error;
        resultsEl.appendChild(e);
      }
      const summary = document.createElement('p');
      summary.className = 'conn-test-summary';
      if (r.signaling && r.turn) {
        summary.textContent = 'Looks good — group workouts should connect even on cellular.';
      } else if (r.signaling && r.stun) {
        summary.textContent = 'Same-WiFi groups should work. Cellular may fail — try the same WiFi.';
      } else if (r.signaling) {
        summary.textContent = 'Matchmaking works but neither STUN nor TURN reach you. Try a different network.';
      } else {
        summary.textContent = 'No connectivity to the matchmaker. Check Wi-Fi/cellular.';
      }
      resultsEl.appendChild(summary);
    } finally {
      btn.disabled = false;
      btn.textContent = '🩺 Test Connection';
    }
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

  // ── Share Workout Card ────────────────────────────────
  const openShareCard = () => {
    if (!lastCompletedWorkout) {
      showToast('Finish a workout to share it.');
      return;
    }
    Audio.buttonPress();
    const canvas = $('share-canvas');
    ShareCard.render(canvas, {
      exerciseName:     lastCompletedWorkout.exerciseName,
      exerciseIcon:     lastCompletedWorkout.icon || '💪',
      sets:             lastCompletedWorkout.sets,
      reps:             lastCompletedWorkout.reps,
      unit:             lastCompletedWorkout.unit,
      duration:         lastCompletedWorkout.duration,
      totalPushups:     lastCompletedWorkout.totalPushups,
      streak:           lastCompletedWorkout.streak,
      difficulty:       lastCompletedWorkout.difficulty,
      isPersonalRecord: lastWorkoutBrokeRecord
    });
    $('share-overlay').classList.remove('hidden');
  };
  const closeShareCard = () => $('share-overlay').classList.add('hidden');

  $('btn-share-workout').addEventListener('click', openShareCard);
  $('btn-share-close').addEventListener('click', closeShareCard);

  $('btn-share-send').addEventListener('click', async () => {
    Audio.buttonPress();
    const canvas = $('share-canvas');
    const sendBtn = $('btn-share-send');
    const originalLabel = sendBtn.textContent;
    sendBtn.disabled = true;
    sendBtn.textContent = 'Preparing…';
    try {
      const shared = await ShareCard.share(canvas, lastCompletedWorkout || {});
      if (!shared) showToast('Image saved — share it from your gallery.');
    } catch (err) {
      showToast('Could not share. Saving image instead.');
      await ShareCard.download(canvas);
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = originalLabel;
    }
  });

  $('btn-share-download').addEventListener('click', async () => {
    Audio.buttonPress();
    await ShareCard.download($('share-canvas'));
    showToast('Image saved to your downloads.');
  });

  // On native iOS the browser download path is a silent no-op — the share
  // sheet (which has "Save Image" built in) is the only reliable exit, so
  // hide the redundant download button there.
  if (window.Capacitor?.isNativePlatform?.()) {
    $('btn-share-download').classList.add('hidden');
  }

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

  // No in-app toasts here: settings changes are silent. The toggle's own
  // on/off state is the feedback, and anything the user needs to be told
  // about reminders comes from iOS itself (the permission prompt and the
  // real notification), not from a banner inside the app.
  $('setting-reminder').addEventListener('change', async (e) => {
    const wantOn = e.target.checked;
    savePreferences();
    if (!Notifications.isAvailable()) return;

    if (wantOn) {
      const status = await Notifications.requestPermission();
      if (status !== 'granted') {
        // Permission refused — snap the toggle back so it reflects reality.
        e.target.checked = false;
        savePreferences();
        return;
      }
      const prefs = Storage.getPreferences();
      await Notifications.scheduleDaily(prefs.reminderHour, prefs.reminderMinute);
    } else {
      await Notifications.cancel();
    }
  });

  $('setting-category').addEventListener('change', (e) => {
    currentCategory = e.target.value;
    savePreferences();
  });

  // ── Submit Feedback ─────────────────────────────────────
  // Confirmation is inline text inside the panel, not a floating banner —
  // nothing on the Settings screen pops a notification.
  let _feedbackStatusTimer = null;
  const setFeedbackStatus = (msg, isError = false) => {
    const el = $('feedback-status');
    el.textContent = msg;
    el.classList.toggle('is-error', isError);
    clearTimeout(_feedbackStatusTimer);
    if (msg) _feedbackStatusTimer = setTimeout(() => { el.textContent = ''; }, 4000);
  };

  $('btn-submit-feedback').addEventListener('click', () => {
    const feedbackText = $('feedback-input').value.trim();
    if (!feedbackText) {
      setFeedbackStatus('Type something first.', true);
      return;
    }

    Storage.saveFeedback(feedbackText);
    $('feedback-input').value = '';
    setFeedbackStatus('Thanks — saved on this device.');
  });
});
