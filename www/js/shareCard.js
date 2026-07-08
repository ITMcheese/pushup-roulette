// ─────────────────────────────────────────────────────────────
// ShareCard — renders a shareable workout summary onto a canvas
// and dispatches it via the native Share API (with download
// fallback for browsers without share support).
// ─────────────────────────────────────────────────────────────

const W = 900;
const H = 1600;

function formatDuration(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.round(totalSeconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

// Wrap text to fit a max width, capped to `maxLines` lines, with ellipsis on the last.
function wrapLines(ctx, text, maxWidth, maxLines) {
  if (!text) return [];
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const probe = line ? line + ' ' + word : word;
    if (ctx.measureText(probe).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    } else {
      line = probe;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && words.length > lines.join(' ').split(/\s+/).length) {
    let last = lines[maxLines - 1];
    while (ctx.measureText(last + '…').width > maxWidth && last.length > 1) {
      last = last.slice(0, -1);
    }
    lines[maxLines - 1] = last + '…';
  }
  return lines;
}

export const ShareCard = {
  /**
   * Render the share card onto a canvas element.
   * @param {HTMLCanvasElement} canvas
   * @param {Object} payload
   *   { exerciseName, exerciseIcon, sets, reps, unit, duration, totalPushups,
   *     streak, difficulty, isPersonalRecord }
   */
  render(canvas, payload) {
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // ── Background gradient ──
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0a0a0f');
    grad.addColorStop(1, '#12121a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Subtle accent glow at top.
    const glow = ctx.createRadialGradient(W / 2, 0, 50, W / 2, 0, 700);
    glow.addColorStop(0, 'rgba(0, 255, 136, 0.25)');
    glow.addColorStop(1, 'rgba(0, 255, 136, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, 700);

    // ── App branding (top) ──
    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 36px "Space Grotesk", "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CALISTHENICS ROULETTE', W / 2, 130);

    ctx.fillStyle = '#8888aa';
    ctx.font = '24px Inter, sans-serif';
    ctx.fillText('Spin. Train. Conquer.', W / 2, 175);

    // ── PR badge (if broken) ──
    if (payload.isPersonalRecord) {
      const badgeW = 340, badgeH = 60;
      const bx = (W - badgeW) / 2;
      const by = 215;
      ctx.fillStyle = 'rgba(255, 170, 0, 0.18)';
      ctx.strokeStyle = '#ffaa00';
      ctx.lineWidth = 2;
      this._roundRect(ctx, bx, by, badgeW, badgeH, 30);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffaa00';
      ctx.font = 'bold 26px Inter, sans-serif';
      ctx.fillText('🏆  NEW PERSONAL RECORD', W / 2, by + 40);
    }

    // ── Exercise icon ──
    ctx.font = '180px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(payload.exerciseIcon || '💪', W / 2, 460);

    // ── Exercise name (wrap to 2 lines) ──
    ctx.fillStyle = '#f0f0f5';
    ctx.font = 'bold 68px "Space Grotesk", "Inter", sans-serif';
    const nameLines = wrapLines(ctx, payload.exerciseName || 'Workout', W - 120, 2);
    let nameY = 560;
    for (const line of nameLines) {
      ctx.fillText(line, W / 2, nameY);
      nameY += 80;
    }

    // ── Difficulty pill ──
    if (payload.difficulty) {
      const diffMap = {
        beginner:     { fg: '#00cc6a', bg: 'rgba(0, 204, 106, 0.15)' },
        intermediate: { fg: '#3c78ff', bg: 'rgba(60, 120, 255, 0.15)' },
        advanced:     { fg: '#ffaa00', bg: 'rgba(255, 170, 0, 0.15)' },
        elite:        { fg: '#ff4466', bg: 'rgba(255, 68, 102, 0.15)' }
      };
      const c = diffMap[payload.difficulty] || diffMap.intermediate;
      const label = payload.difficulty.toUpperCase();
      ctx.font = 'bold 28px Inter, sans-serif';
      const padX = 30;
      const w = ctx.measureText(label).width + padX * 2;
      const h = 56;
      const x = (W - w) / 2;
      const y = nameY - 20;
      ctx.fillStyle = c.bg;
      ctx.strokeStyle = c.fg;
      ctx.lineWidth = 2;
      this._roundRect(ctx, x, y, w, h, 28);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = c.fg;
      ctx.fillText(label, W / 2, y + 38);
    }

    // ── Stat tiles (2×2) ──
    const grid = {
      x: 80, y: 870, w: W - 160,
      colGap: 24, rowGap: 24
    };
    const tileW = (grid.w - grid.colGap) / 2;
    const tileH = 200;
    const unit = payload.unit === 'seconds' ? 's' : '';

    const tiles = [
      { label: 'TOTAL REPS', value: String(payload.totalPushups ?? 0) + unit },
      { label: 'SETS × REPS', value: `${payload.sets ?? 0}×${payload.reps ?? 0}${unit}` },
      { label: 'DURATION', value: formatDuration(payload.duration ?? 0) },
      { label: 'STREAK', value: (payload.streak ?? 0) + ' 🔥' }
    ];

    tiles.forEach((tile, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = grid.x + col * (tileW + grid.colGap);
      const y = grid.y + row * (tileH + grid.rowGap);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      this._roundRect(ctx, x, y, tileW, tileH, 24);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#00ff88';
      ctx.font = 'bold 72px "Space Grotesk", "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(tile.value, x + tileW / 2, y + 105);

      ctx.fillStyle = '#8888aa';
      ctx.font = 'bold 22px Inter, sans-serif';
      ctx.fillText(tile.label, x + tileW / 2, y + 160);
    });

    // ── Footer ──
    ctx.fillStyle = '#8888aa';
    ctx.font = '24px Inter, sans-serif';
    ctx.textAlign = 'center';
    const date = new Date().toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric'
    });
    ctx.fillText(date, W / 2, H - 100);

    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 28px Inter, sans-serif';
    ctx.fillText('🎰 Spin yours on Calisthenics Roulette', W / 2, H - 50);
  },

  _roundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  },

  /** Read the canvas pixels as a PNG Blob (async). */
  async toBlob(canvas) {
    return new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/png', 0.95);
    });
  },

  /**
   * Share the card image. On native iOS (Capacitor) the blob-download and
   * Web-Share-with-files paths are unreliable inside WKWebView, so we write
   * the PNG to the app's cache dir and open the native share sheet — which
   * also has "Save Image" built in. On the web we use the Web Share API
   * with a download fallback. Returns true if a share sheet opened.
   */
  async share(canvas, payload) {
    const title = 'Calisthenics Roulette';
    const text  = payload?.exerciseName
      ? `Just spun ${payload.exerciseName} — ${payload.totalPushups || 0} reps in ${formatDuration(payload.duration || 0)} 💪`
      : 'Just finished a Calisthenics Roulette workout 💪';

    // ── Native path (Capacitor iOS) ──
    const cap = window.Capacitor;
    const plugins = cap?.Plugins;
    if (cap?.isNativePlatform?.() && plugins?.Share && plugins?.Filesystem) {
      try {
        const base64 = canvas.toDataURL('image/png').split(',')[1];
        const path = `calisthenics-roulette-share.png`;
        await plugins.Filesystem.writeFile({
          path,
          data: base64,
          directory: 'CACHE'
        });
        const { uri } = await plugins.Filesystem.getUri({ path, directory: 'CACHE' });
        await plugins.Share.share({ title, text, files: [uri] });
        return true;
      } catch (err) {
        // "Share canceled" = the user closed the sheet; that's a success.
        if (/cancel/i.test(String(err?.message || err))) return true;
        // Otherwise fall through to the web path below.
      }
    }

    // ── Web path ──
    const blob = await this.toBlob(canvas);
    if (!blob) return false;
    const filename = `calisthenics-roulette-${Date.now()}.png`;
    const file = new File([blob], filename, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title, text });
        return true;
      } catch (err) {
        // User cancelled the share sheet — that's fine.
        if (err && err.name === 'AbortError') return true;
        // Fall through to download.
      }
    }

    this.download(canvas, filename);
    return false;
  },

  /** Trigger a regular browser download of the canvas PNG. */
  async download(canvas, filename) {
    const blob = await this.toBlob(canvas);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `calisthenics-roulette-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
};
