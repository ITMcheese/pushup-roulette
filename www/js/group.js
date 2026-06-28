/**
 * Group — Peer-to-peer group workout sync via WebRTC/PeerJS.
 *
 * Architecture: Star topology (host is hub, members connect to host).
 * Data flows P2P after initial signaling handshake.
 * Max 30 participants per session.
 */

const MAX_MEMBERS = 30;
const MAX_NAME_LENGTH = 30;
const ROOM_CODE_LENGTH = 6;
const ROOM_PREFIX = 'bwroulette-';

// WebRTC ICE servers. STUN finds each peer's public address; TURN relays
// the connection when a direct peer-to-peer link can't be opened (common
// when the two devices are on different networks, e.g. Wi-Fi + cellular).
const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
  ]
};

const MSG_TYPES = {
  SPIN_RESULT: 'spin_result',
  SET_COMPLETE: 'set_complete',
  WORKOUT_COMPLETE: 'workout_complete',
  MEMBER_JOIN: 'member_join',
  MEMBER_LIST: 'member_list',
  WORKOUT_START: 'workout_start',
  PAUSE_TOGGLE: 'pause_toggle',
  TIME_ADJUST: 'time_adjust'
};

export const Group = {
  peer: null,
  connections: [],           // Host keeps all member connections
  hostConnection: null,      // Member keeps connection to host
  members: [],               // [{ id, name, isHost, setsCompleted, isFinished }]
  roomCode: null,
  displayName: null,
  _isHost: false,
  _callbacks: { onSpin: null, onMemberUpdate: null, onSetComplete: null, onWorkoutStart: null, onPauseToggle: null, onTimeAdjust: null },

  /**
   * Create a new group session as host.
   * Returns room code string (e.g., "ABCD").
   */
  async createSession(displayName) {
    this.displayName = displayName;
    this._isHost = true;
    this.roomCode = this._generateCode();
    this.members = [{ id: 'host', name: displayName, isHost: true, setsCompleted: 0, isFinished: false }];

    return new Promise((resolve, reject) => {
      this.peer = new window.Peer(ROOM_PREFIX + this.roomCode, { config: ICE_CONFIG });
      this.peer.on('open', () => {
        this.peer.on('connection', (conn) => this._handleIncomingConnection(conn));
        resolve(this.roomCode);
      });
      this.peer.on('error', (err) => reject(err));
    });
  },

  /**
   * Join an existing session as a member.
   */
  async joinSession(roomCode, displayName) {
    this.displayName = displayName;
    this._isHost = false;
    this.roomCode = roomCode.toUpperCase();

    return new Promise((resolve, reject) => {
      const fail = (err) => {
        clearTimeout(timer);
        try { if (this.peer) this.peer.destroy(); } catch (e) { /* ignore */ }
        this.peer = null;
        this.hostConnection = null;
        reject(err);
      };
      // Never hang forever if the code is wrong / the host is gone.
      const timer = setTimeout(() => fail(new Error('Join timed out')), 15000);

      this.peer = new window.Peer(undefined, { config: ICE_CONFIG });
      this.peer.on('open', () => {
        const conn = this.peer.connect(ROOM_PREFIX + this.roomCode, { metadata: { name: displayName } });
        conn.on('open', () => {
          clearTimeout(timer);
          this.hostConnection = conn;
          this._setupMemberListeners(conn);
          resolve();
        });
        conn.on('error', (err) => fail(err));
      });
      this.peer.on('error', (err) => fail(err));
    });
  },

  /**
   * Host: handle incoming member connection.
   */
  _handleIncomingConnection(conn) {
    if (this.members.length >= MAX_MEMBERS) {
      conn.close();
      return;
    }
    conn.on('open', () => {
      const member = {
        id: conn.peer,
        name: this._sanitizeName(conn.metadata?.name),
        isHost: false,
        setsCompleted: 0,
        isFinished: false
      };
      this.members.push(member);
      this.connections.push(conn);
      this._setupHostListeners(conn, member);
      this._broadcastToAll({ type: MSG_TYPES.MEMBER_LIST, data: this.members });
      this._notifyMemberUpdate();
    });
    conn.on('close', () => {
      this.connections = this.connections.filter(c => c !== conn);
      this.members = this.members.filter(m => m.id !== conn.peer);
      this._broadcastToAll({ type: MSG_TYPES.MEMBER_LIST, data: this.members });
      this._notifyMemberUpdate();
    });
  },

  /**
   * Host: listen for messages from a connected member.
   */
  _setupHostListeners(conn, member) {
    conn.on('data', (msg) => {
      if (!this._isValidMessage(msg)) return;
      switch (msg.type) {
        case MSG_TYPES.SET_COMPLETE:
          member.setsCompleted = msg.data.setNumber;
          this._broadcastToAll({
            type: MSG_TYPES.SET_COMPLETE,
            data: { memberId: member.id, memberName: member.name, setNumber: msg.data.setNumber }
          });
          if (this._callbacks.onSetComplete) this._callbacks.onSetComplete(member.id, msg.data.setNumber);
          this._notifyMemberUpdate();
          break;
        case MSG_TYPES.WORKOUT_COMPLETE:
          member.isFinished = true;
          this._broadcastToAll({
            type: MSG_TYPES.WORKOUT_COMPLETE,
            data: { memberId: member.id, memberName: member.name, stats: msg.data }
          });
          this._notifyMemberUpdate();
          break;
      }
    });
  },

  /**
   * Member: listen for messages from the host.
   */
  _setupMemberListeners(conn) {
    conn.on('data', (msg) => {
      if (!this._isValidMessage(msg)) return;
      switch (msg.type) {
        case MSG_TYPES.MEMBER_LIST:
          this.members = msg.data;
          this._notifyMemberUpdate();
          break;
        case MSG_TYPES.SPIN_RESULT:
          if (this._callbacks.onSpin) this._callbacks.onSpin(msg.data);
          break;
        case MSG_TYPES.SET_COMPLETE:
          if (this._callbacks.onSetComplete) this._callbacks.onSetComplete(msg.data.memberId, msg.data.setNumber);
          // Also update local member list
          const memberSC = this.members.find(m => m.id === msg.data.memberId);
          if (memberSC) memberSC.setsCompleted = msg.data.setNumber;
          this._notifyMemberUpdate();
          break;
        case MSG_TYPES.WORKOUT_START:
          if (this._callbacks.onWorkoutStart) this._callbacks.onWorkoutStart(msg.data);
          break;
        case MSG_TYPES.WORKOUT_COMPLETE:
          const memberWC = this.members.find(mem => mem.id === msg.data.memberId);
          if (memberWC) memberWC.isFinished = true;
          this._notifyMemberUpdate();
          break;
        case MSG_TYPES.PAUSE_TOGGLE:
          if (this._callbacks.onPauseToggle) this._callbacks.onPauseToggle(msg.data.isPaused);
          break;
        case MSG_TYPES.TIME_ADJUST:
          if (this._callbacks.onTimeAdjust) this._callbacks.onTimeAdjust(msg.data.type, msg.data.delta);
          break;
      }
    });
    conn.on('close', () => {
      this.hostConnection = null;
    });
  },

  /**
   * Host: broadcast a spin result to all members.
   */
  broadcastSpin(challenge) {
    if (!this._isHost) return;
    const data = {
      exercise: challenge.exercise,
      reps: challenge.reps,
      sets: challenge.sets,
      rest: challenge.rest
    };
    this._broadcastToAll({ type: MSG_TYPES.SPIN_RESULT, data });
  },

  /**
   * Host: broadcast workout start to all members.
   */
  broadcastWorkoutStart(challenge) {
    if (!this._isHost) return;
    this._broadcastToAll({ type: MSG_TYPES.WORKOUT_START, data: challenge });
  },

  /**
   * Broadcast that the local user completed a set.
   */
  broadcastSetComplete(setNumber) {
    if (this._isHost) {
      const self = this.members.find(m => m.isHost);
      if (self) self.setsCompleted = setNumber;
      this._broadcastToAll({
        type: MSG_TYPES.SET_COMPLETE,
        data: { memberId: 'host', memberName: this.displayName, setNumber }
      });
      this._notifyMemberUpdate();
    } else if (this.hostConnection) {
      this.hostConnection.send({ type: MSG_TYPES.SET_COMPLETE, data: { setNumber } });
    }
  },

  /**
   * Broadcast that the local user completed the entire workout.
   */
  broadcastWorkoutComplete(stats) {
    if (this._isHost) {
      const self = this.members.find(m => m.isHost);
      if (self) self.isFinished = true;
      this._broadcastToAll({
        type: MSG_TYPES.WORKOUT_COMPLETE,
        data: { memberId: 'host', memberName: this.displayName, stats }
      });
      this._notifyMemberUpdate();
    } else if (this.hostConnection) {
      this.hostConnection.send({ type: MSG_TYPES.WORKOUT_COMPLETE, data: stats });
    }
  },

  /**
   * Send a message to all connected members (host only).
   */
  _broadcastToAll(msg) {
    this.connections.forEach(conn => {
      if (conn.open) conn.send(msg);
    });
  },

  /* ── Callback registration ─────────────────────────────── */

  onSpinReceived(cb) { this._callbacks.onSpin = cb; },
  onMemberUpdate(cb) { this._callbacks.onMemberUpdate = cb; },
  onSetCompleteReceived(cb) { this._callbacks.onSetComplete = cb; },
  onWorkoutStart(cb) { this._callbacks.onWorkoutStart = cb; },
  onPauseToggleReceived(cb) { this._callbacks.onPauseToggle = cb; },
  onTimeAdjustReceived(cb) { this._callbacks.onTimeAdjust = cb; },

  /**
   * Host: broadcast a pause/resume toggle to all members.
   */
  broadcastPauseToggle(isPaused) {
    if (!this._isHost) return;
    this._broadcastToAll({ type: MSG_TYPES.PAUSE_TOGGLE, data: { isPaused } });
  },

  /**
   * Host: broadcast a time adjustment to all members.
   */
  broadcastTimeAdjust(type, delta) {
    if (!this._isHost) return;
    this._broadcastToAll({ type: MSG_TYPES.TIME_ADJUST, data: { type, delta } });
  },

  _notifyMemberUpdate() {
    if (this._callbacks.onMemberUpdate) this._callbacks.onMemberUpdate([...this.members]);
  },

  /* ── Accessors ──────────────────────────────────────────── */

  isHost() { return this._isHost; },
  isConnected() { return this.peer !== null && !this.peer.destroyed; },
  getMembers() { return [...this.members]; },
  getRoomCode() { return this.roomCode; },

  _sanitizeName(name) {
    if (typeof name !== 'string') return 'Unknown';
    return name.slice(0, MAX_NAME_LENGTH).replace(/[<>&"'/]/g, '');
  },

  _isValidMessage(msg) {
    if (msg === null || typeof msg !== 'object') return false;
    if (typeof msg.type !== 'string') return false;
    return Object.values(MSG_TYPES).includes(msg.type);
  },

  _generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const values = crypto.getRandomValues(new Uint8Array(ROOM_CODE_LENGTH));
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += chars[values[i] % chars.length];
    return code;
  },

  /**
   * Tear down all connections and reset state.
   */
  disconnect() {
    this.connections.forEach(c => c.close());
    if (this.hostConnection) this.hostConnection.close();
    if (this.peer) this.peer.destroy();
    this.peer = null;
    this.connections = [];
    this.hostConnection = null;
    this.members = [];
    this.roomCode = null;
    this._isHost = false;
  }
};
