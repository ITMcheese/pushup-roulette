/**
 * Group — group workout sync over a tiny WebSocket relay.
 *
 * Architecture: star topology through wss://calisthenics-relay.fly.dev.
 * The host owns the authoritative member list; members' events are
 * forwarded to the host; the host's events are broadcast to all members.
 *
 * This replaced the PeerJS/WebRTC P2P implementation: group messages are
 * a few hundred bytes of JSON state-sync, and WebRTC's NAT traversal
 * (STUN/TURN) was the source of every cross-network connection failure.
 * A relay over WSS works on any network that has internet — cellular,
 * WiFi, or a mix — with no TURN servers and no PeerJS cloud dependency.
 */

const RELAY_WSS  = 'wss://calisthenics-relay.fly.dev';
const RELAY_HTTP = 'https://calisthenics-relay.fly.dev';

const ROOM_CODE_LENGTH = 6;
const CREATE_TIMEOUT_MS = 12000;
const JOIN_TIMEOUT_MS = 12000;

const MSG_TYPES = {
  SPIN_RESULT: 'spin_result',
  SET_COMPLETE: 'set_complete',
  WORKOUT_COMPLETE: 'workout_complete',
  MEMBER_LIST: 'member_list',
  WORKOUT_START: 'workout_start',
  PAUSE_TOGGLE: 'pause_toggle',
  TIME_ADJUST: 'time_adjust'
};

export const Group = {
  ws: null,
  members: [],               // [{ id, name, isHost, setsCompleted, isFinished }]
  roomCode: null,
  displayName: null,
  _isHost: false,
  _deliberateClose: false,
  _callbacks: { onSpin: null, onMemberUpdate: null, onSetComplete: null, onWorkoutStart: null, onPauseToggle: null, onTimeAdjust: null, onConnectionState: null, onHostDisconnect: null },

  connectionInfo: { state: 'idle', path: null, detail: null },

  _emitConnectionState(state, path = 'relay') {
    this.connectionInfo = { state, path, detail: null };
    if (this._callbacks.onConnectionState) {
      this._callbacks.onConnectionState({ ...this.connectionInfo });
    }
  },

  onConnectionState(cb) { this._callbacks.onConnectionState = cb; },
  onHostDisconnect(cb) { this._callbacks.onHostDisconnect = cb; },
  getConnectionInfo() { return { ...this.connectionInfo }; },

  /* ── connection plumbing ───────────────────────────────────── */

  /**
   * Open a socket to the relay and resolve once the given ack arrives.
   * Rejects on timeout, socket error, or an { t:'error' } reply.
   */
  _connect(hello, ackType, timeoutMs) {
    return new Promise((resolve, reject) => {
      this._deliberateClose = false;
      this._emitConnectionState('signaling');

      let settled = false;
      const fail = (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { ws.close(); } catch (_) {}
        if (this.ws === ws) this.ws = null;
        this._emitConnectionState('failed');
        reject(err instanceof Error ? err : new Error(String(err)));
      };
      const timer = setTimeout(() => fail(new Error('Join timed out')), timeoutMs);

      let ws;
      try {
        ws = new WebSocket(RELAY_WSS);
      } catch (e) { fail(e); return; }
      this.ws = ws;

      ws.onopen = () => {
        this._emitConnectionState('connecting');
        try { ws.send(JSON.stringify(hello)); } catch (e) { fail(e); }
      };

      ws.onmessage = (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch { return; }
        if (!msg || typeof msg.t !== 'string') return;

        if (!settled) {
          if (msg.t === ackType) {
            settled = true;
            clearTimeout(timer);
            this._emitConnectionState('connected');
            resolve(msg);
            return;
          }
          if (msg.t === 'error') {
            fail(new Error(msg.reason || 'relay error'));
            return;
          }
        }
        this._handleRelayMessage(msg);
      };

      ws.onerror = () => fail(new Error('Could not reach the group server'));

      ws.onclose = () => {
        if (!settled) { fail(new Error('Connection closed')); return; }
        if (this.ws !== ws) return; // superseded by a newer session
        this.ws = null;
        this._emitConnectionState('closed');
        // Whether the host vanished or our own link dropped, the member's
        // recovery is the same: restore solo controls via the callback.
        if (!this._deliberateClose && this._callbacks.onHostDisconnect) {
          this._callbacks.onHostDisconnect();
        }
      };
    });
  },

  _sendApp(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try { this.ws.send(JSON.stringify({ t: 'msg', data })); } catch (_) {}
    }
  },

  /* ── relay message handling ────────────────────────────────── */

  _handleRelayMessage(msg) {
    switch (msg.t) {
      case 'member_join': {           // host only
        if (!this._isHost) return;
        this.members.push({ id: msg.id, name: msg.name, isHost: false, setsCompleted: 0, isFinished: false });
        this._sendApp({ type: MSG_TYPES.MEMBER_LIST, data: this.members });
        this._notifyMemberUpdate();
        break;
      }
      case 'member_leave': {          // host only
        if (!this._isHost) return;
        this.members = this.members.filter(m => m.id !== msg.id);
        this._sendApp({ type: MSG_TYPES.MEMBER_LIST, data: this.members });
        this._notifyMemberUpdate();
        break;
      }
      case 'host_left': {             // members only
        // Server closes the room; onclose fires next and runs the
        // host-disconnect recovery. Nothing else to do here.
        break;
      }
      case 'msg': {
        if (!this._isValidMessage(msg.data)) return;
        if (this._isHost) this._handleFromMember(msg.from, msg.data);
        else this._handleFromHost(msg.data);
        break;
      }
    }
  },

  /** Host: a member reported progress. */
  _handleFromMember(memberId, appMsg) {
    const member = this.members.find(m => m.id === memberId);
    if (!member) return;
    switch (appMsg.type) {
      case MSG_TYPES.SET_COMPLETE:
        member.setsCompleted = appMsg.data.setNumber;
        this._sendApp({
          type: MSG_TYPES.SET_COMPLETE,
          data: { memberId: member.id, memberName: member.name, setNumber: appMsg.data.setNumber }
        });
        if (this._callbacks.onSetComplete) this._callbacks.onSetComplete(member.id, appMsg.data.setNumber);
        this._notifyMemberUpdate();
        break;
      case MSG_TYPES.WORKOUT_COMPLETE:
        member.isFinished = true;
        this._sendApp({
          type: MSG_TYPES.WORKOUT_COMPLETE,
          data: { memberId: member.id, memberName: member.name, stats: appMsg.data }
        });
        this._notifyMemberUpdate();
        break;
    }
  },

  /** Member: the host broadcast an event. */
  _handleFromHost(appMsg) {
    switch (appMsg.type) {
      case MSG_TYPES.MEMBER_LIST:
        this.members = appMsg.data;
        this._notifyMemberUpdate();
        break;
      case MSG_TYPES.SPIN_RESULT:
        if (this._callbacks.onSpin) this._callbacks.onSpin(appMsg.data);
        break;
      case MSG_TYPES.SET_COMPLETE: {
        if (this._callbacks.onSetComplete) this._callbacks.onSetComplete(appMsg.data.memberId, appMsg.data.setNumber);
        const m = this.members.find(mm => mm.id === appMsg.data.memberId);
        if (m) m.setsCompleted = appMsg.data.setNumber;
        this._notifyMemberUpdate();
        break;
      }
      case MSG_TYPES.WORKOUT_START:
        if (this._callbacks.onWorkoutStart) this._callbacks.onWorkoutStart(appMsg.data);
        break;
      case MSG_TYPES.WORKOUT_COMPLETE: {
        const m = this.members.find(mm => mm.id === appMsg.data.memberId);
        if (m) m.isFinished = true;
        this._notifyMemberUpdate();
        break;
      }
      case MSG_TYPES.PAUSE_TOGGLE:
        if (this._callbacks.onPauseToggle) this._callbacks.onPauseToggle(appMsg.data.isPaused);
        break;
      case MSG_TYPES.TIME_ADJUST:
        if (this._callbacks.onTimeAdjust) this._callbacks.onTimeAdjust(appMsg.data.type, appMsg.data.delta);
        break;
    }
  },

  /* ── public API (unchanged surface) ────────────────────────── */

  async createSession(displayName) {
    if (this.isConnected()) this.disconnect();
    this.displayName = displayName;
    this._isHost = true;
    this.roomCode = this._generateCode();
    this.members = [{ id: 'host', name: displayName, isHost: true, setsCompleted: 0, isFinished: false }];
    await this._connect(
      { t: 'create', code: this.roomCode, name: displayName },
      'created',
      CREATE_TIMEOUT_MS
    );
    return this.roomCode;
  },

  async joinSession(roomCode, displayName) {
    if (this.isConnected()) this.disconnect();
    this.displayName = displayName;
    this._isHost = false;
    this.roomCode = roomCode.toUpperCase();
    await this._connect(
      { t: 'join', code: this.roomCode, name: displayName },
      'joined',
      JOIN_TIMEOUT_MS
    );
  },

  broadcastSpin(challenge) {
    if (!this._isHost) return;
    this._sendApp({
      type: MSG_TYPES.SPIN_RESULT,
      data: {
        exercise: challenge.exercise,
        reps: challenge.reps,
        sets: challenge.sets,
        rest: challenge.rest,
        workTime: challenge.workTime,
        unit: challenge.unit
      }
    });
  },

  broadcastWorkoutStart(challenge) {
    if (!this._isHost) return;
    this._sendApp({ type: MSG_TYPES.WORKOUT_START, data: challenge });
  },

  broadcastSetComplete(setNumber) {
    if (this._isHost) {
      const self = this.members.find(m => m.isHost);
      if (self) self.setsCompleted = setNumber;
      this._sendApp({
        type: MSG_TYPES.SET_COMPLETE,
        data: { memberId: 'host', memberName: this.displayName, setNumber }
      });
      this._notifyMemberUpdate();
    } else {
      this._sendApp({ type: MSG_TYPES.SET_COMPLETE, data: { setNumber } });
    }
  },

  broadcastWorkoutComplete(stats) {
    if (this._isHost) {
      const self = this.members.find(m => m.isHost);
      if (self) self.isFinished = true;
      this._sendApp({
        type: MSG_TYPES.WORKOUT_COMPLETE,
        data: { memberId: 'host', memberName: this.displayName, stats }
      });
      this._notifyMemberUpdate();
    } else {
      this._sendApp({ type: MSG_TYPES.WORKOUT_COMPLETE, data: stats });
    }
  },

  broadcastPauseToggle(isPaused) {
    if (!this._isHost) return;
    this._sendApp({ type: MSG_TYPES.PAUSE_TOGGLE, data: { isPaused } });
  },

  broadcastTimeAdjust(type, delta) {
    if (!this._isHost) return;
    this._sendApp({ type: MSG_TYPES.TIME_ADJUST, data: { type, delta } });
  },

  /* ── callback registration ─────────────────────────────────── */

  onSpinReceived(cb) { this._callbacks.onSpin = cb; },
  onMemberUpdate(cb) { this._callbacks.onMemberUpdate = cb; },
  onSetCompleteReceived(cb) { this._callbacks.onSetComplete = cb; },
  onWorkoutStart(cb) { this._callbacks.onWorkoutStart = cb; },
  onPauseToggleReceived(cb) { this._callbacks.onPauseToggle = cb; },
  onTimeAdjustReceived(cb) { this._callbacks.onTimeAdjust = cb; },

  _notifyMemberUpdate() {
    if (this._callbacks.onMemberUpdate) this._callbacks.onMemberUpdate([...this.members]);
  },

  /* ── accessors ─────────────────────────────────────────────── */

  isHost() { return this._isHost; },
  isConnected() { return !!this.ws && this.ws.readyState === WebSocket.OPEN; },
  getMembers() { return [...this.members]; },
  getRoomCode() { return this.roomCode; },

  _isValidMessage(msg) {
    if (msg === null || typeof msg !== 'object') return false;
    if (typeof msg.type !== 'string') return false;
    return Object.values(MSG_TYPES).includes(msg.type);
  },

  _generateCode() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const values = crypto.getRandomValues(new Uint8Array(ROOM_CODE_LENGTH));
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += chars[values[i] % chars.length];
    return code;
  },

  /**
   * Diagnose relay reachability from this device.
   * Returns { server: bool, websocket: bool, error?: string }.
   */
  async testConnection() {
    const result = { server: false, websocket: false };

    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(RELAY_HTTP + '/health', { signal: ctrl.signal });
      clearTimeout(t);
      result.server = res.ok;
    } catch (e) {
      result.error = 'Server unreachable: ' + (e?.message || e);
      return result;
    }

    try {
      await new Promise((resolve, reject) => {
        const t = setTimeout(() => { try { probe.close(); } catch (_) {} reject(new Error('websocket timeout')); }, 8000);
        const probe = new WebSocket(RELAY_WSS);
        probe.onopen = () => { clearTimeout(t); probe.close(); resolve(); };
        probe.onerror = () => { clearTimeout(t); reject(new Error('websocket blocked')); };
      });
      result.websocket = true;
    } catch (e) {
      result.error = 'WebSocket blocked: ' + (e?.message || e);
    }

    return result;
  },

  disconnect() {
    this._deliberateClose = true;
    this._callbacks.onHostDisconnect = null;
    if (this.ws) { try { this.ws.close(); } catch (_) {} }
    this.ws = null;
    this.members = [];
    this.roomCode = null;
    this._isHost = false;
    this.connectionInfo = { state: 'idle', path: null, detail: null };
  }
};
