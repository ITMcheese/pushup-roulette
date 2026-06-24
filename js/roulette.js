/**
 * Roulette — Native scroll and snap style selection and spin engine
 *
 * Uses native container scrolling, scroll snapping, click-to-select, and
 * a requestAnimationFrame scrollTop animation for programmatic spinning.
 */

import { EXERCISES } from './database.js';
import { Audio } from './audio.js';

/* ── helpers ───────────────────────────────────────────────────────── */

/** Easing: fast start → smooth deceleration */
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/** Fisher-Yates shuffle (in-place, returns array) */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ── constants ─────────────────────────────────────────────────────── */

const ITEM_HEIGHT   = 64;   // px – must match CSS .roulette-item height
const SPIN_DURATION = 2500; // ms
const REPEATS       = 3;    // how many full copies of the exercise list

/* ── module ────────────────────────────────────────────────────────── */

export const Roulette = {
  containerEl: null,
  stripEl:     null,
  isSpinning:  false,
  _items: [],
  _activeIndex: -1,
  _selectionCallback: null,
  _hasEvents: false,

  /* ── public API ────────────────────────────────────────────────── */

  /**
   * Attach to DOM elements and build the initial strip.
   * @param {HTMLElement} containerEl  The visible roulette window
   * @param {HTMLElement} stripEl      The scrolling inner strip
   */
  init(containerEl, stripEl) {
    this.containerEl = containerEl;
    this.stripEl     = stripEl;
    this._buildStrip();
    this._setupEvents();
  },

  /**
   * Register a callback for when an exercise is selected.
   * @param {Function} callback
   */
  onSelect(callback) {
    this._selectionCallback = callback;
  },

  /**
   * Spin to the given target exercise.
   * Returns a Promise that resolves once the animation completes.
   *
   * @param {{ id: string, name: string, icon: string }} targetExercise
   * @returns {Promise<void>}
   */
  spin(targetExercise) {
    if (this.isSpinning) return Promise.resolve();
    this.isSpinning = true;

    // Lock native scroll by setting container to 'spinning'
    this.containerEl.classList.add('spinning');
    // Align native scroll position to 0 so we can translate relative to the container top
    this.containerEl.scrollTop = 0;

    return new Promise(resolve => {
      // Find the index of the exercise in copy 0 (start position)
      const startIndex = this._items.findIndex(ex => ex.id === targetExercise.id);
      if (startIndex === -1) {
        this.containerEl.classList.remove('spinning');
        this.isSpinning = false;
        resolve();
        return;
      }

      // Find the index of the exercise in copy 2 (target position)
      let targetIndex = -1;
      for (let i = EXERCISES.length * 2; i < this._items.length; i++) {
        if (this._items[i].id === targetExercise.id) {
          targetIndex = i;
          break;
        }
      }
      if (targetIndex === -1) targetIndex = startIndex;

      const startY = -(startIndex * ITEM_HEIGHT);
      const endY = -(targetIndex * ITEM_HEIGHT);
      const distanceY = endY - startY;

      // Start position transform
      this.stripEl.style.transform = `translateY(${startY}px)`;

      let lastTickIndex = startIndex;
      const t0 = performance.now();

      const frame = (now) => {
        const elapsed = now - t0;
        const progress = Math.min(elapsed / SPIN_DURATION, 1);
        const eased = easeOutCubic(progress);

        const currentY = startY + distanceY * eased;
        this.stripEl.style.transform = `translateY(${currentY}px)`;

        // Play tick sounds as items cross the center line
        const currentItemIndex = Math.round(-currentY / ITEM_HEIGHT);
        if (currentItemIndex !== lastTickIndex) {
          if (progress < 0.92) {
            Audio.spinTick();
          }
          lastTickIndex = currentItemIndex;
        }

        if (progress < 1) {
          requestAnimationFrame(frame);
        } else {
          // Reset strip transform to 0 and align container scrollTop natively
          this.stripEl.style.transform = 'translateY(0px)';
          this.containerEl.scrollTop = targetIndex * ITEM_HEIGHT;
          this.containerEl.classList.remove('spinning');

          Audio.spinComplete();
          Audio.vibrate([80, 40, 80]);

          // Highlight the winning item
          this.stripEl.querySelectorAll('.roulette-item.active')
            .forEach(el => el.classList.remove('active'));
          const items = this.stripEl.querySelectorAll('.roulette-item');
          if (items[targetIndex]) {
            items[targetIndex].classList.add('active');
          }
          this._activeIndex = targetIndex;

          // Keep isSpinning true for an extra 150ms to ignore trailing scroll events
          setTimeout(() => {
            this.isSpinning = false;
          }, 150);
          
          resolve();
        }
      };

      requestAnimationFrame(frame);
    });
  },

  /**
   * Instantly align the roulette wheel to the given target exercise.
   * Highlight the winning item.
   *
   * @param {{ id: string, name: string, icon: string }} targetExercise
   */
  alignTo(targetExercise) {
    if (this.isSpinning) return;
    this.isSpinning = true;

    // Use native snapping for instant align
    this.containerEl.classList.add('spinning');

    let targetIndex = -1;
    for (let i = EXERCISES.length; i < EXERCISES.length * 2; i++) {
      if (this._items[i].id === targetExercise.id) {
        targetIndex = i;
        break;
      }
    }
    if (targetIndex === -1) {
      targetIndex = this._items.findIndex(ex => ex.id === targetExercise.id);
    }

    if (targetIndex === -1) {
      this.containerEl.classList.remove('spinning');
      this.isSpinning = false;
      return;
    }

    // Ensure transform is 0 and scroll is correctly aligned
    this.stripEl.style.transform = 'translateY(0px)';
    this.containerEl.scrollTop = targetIndex * ITEM_HEIGHT;
    this.containerEl.classList.remove('spinning');

    // Highlight the winning item
    this.stripEl.querySelectorAll('.roulette-item.active')
      .forEach(el => el.classList.remove('active'));
    const items = this.stripEl.querySelectorAll('.roulette-item');
    if (items[targetIndex]) {
      items[targetIndex].classList.add('active');
    }
    this._activeIndex = targetIndex;

    // Keep isSpinning true for an extra 150ms to ignore scroll events
    setTimeout(() => {
      this.isSpinning = false;
    }, 150);
  },

  /**
   * Reset the strip to its initial (un-spun) position.
   */
  reset() {
    this.isSpinning = false;
    this._buildStrip();
  },

  /* ── internal ──────────────────────────────────────────────────── */

  /**
   * Build (or rebuild) the strip element with shuffled exercise items.
   */
  _buildStrip() {
    this.stripEl.innerHTML = '';
    this._items = [];

    // Create REPEATS shuffled copies of the exercise list
    for (let r = 0; r < REPEATS; r++) {
      const copy = shuffle([...EXERCISES]);
      this._items.push(...copy);
    }

    // Render DOM
    const fragment = document.createDocumentFragment();
    this._items.forEach(ex => {
      const div = document.createElement('div');
      div.className = 'roulette-item';
      div.dataset.id = ex.id;
      div.textContent = `${ex.icon}  ${ex.name}`;
      fragment.appendChild(div);
    });
    this.stripEl.appendChild(fragment);

    // Initial position: center of the strip (first item of middle copy)
    const middleIndex = EXERCISES.length;
    this.containerEl.scrollTop = middleIndex * ITEM_HEIGHT;
    this._activeIndex = middleIndex;
    
    // Highlight initial active item
    const items = this.stripEl.querySelectorAll('.roulette-item');
    if (items[middleIndex]) {
      items[middleIndex].classList.add('active');
    }
  },

  /**
   * Attach scroll and click listeners
   */
  _setupEvents() {
    if (this._hasEvents) return;
    this._hasEvents = true;

    let scrollTimeout;

    this.containerEl.addEventListener('scroll', () => {
      const scrollTop = this.containerEl.scrollTop;
      const index = Math.round(scrollTop / ITEM_HEIGHT);

      if (index !== this._activeIndex && index >= 0 && index < this._items.length) {
        this._activeIndex = index;

        // Highlight active
        this.stripEl.querySelectorAll('.roulette-item.active')
          .forEach(el => el.classList.remove('active'));
        const items = this.stripEl.querySelectorAll('.roulette-item');
        if (items[index]) {
          items[index].classList.add('active');
        }

        // Play tick sound
        Audio.spinTick();
      }

      if (this.isSpinning) return;

      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        if (this._selectionCallback && index >= 0 && index < this._items.length) {
          this._selectionCallback(this._items[index]);
        }
      }, 150);
    });

    this.containerEl.addEventListener('click', (e) => {
      if (this.isSpinning) return;
      const item = e.target.closest('.roulette-item');
      if (!item) return;

      const items = Array.from(this.stripEl.children);
      const clickedIndex = items.indexOf(item);
      if (clickedIndex !== -1) {
        this.containerEl.scrollTo({
          top: clickedIndex * ITEM_HEIGHT,
          behavior: 'smooth'
        });
      }
    });
  }
};
