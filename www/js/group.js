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
const JOIN_TIMEOUT_MS = 25000;

// WebRTC ICE servers. STUN finds each peer's public address; TURN relays
// the connection when a direct peer-to-peer link can't be opened (common
// when the two devices are on different networks, e.g. Wi-Fi + cellular).
//
// We list several free TURN providers in fallback order. Free public TURN
// is best-effort — for reliable cross-network connections (especially over
// cellular) the founder should sign up for a free Metered.ca account
// (50 GB/mo free tier) and we'll swap in stable credentials.
const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'turn:openrelay.metered.ca:80',                   username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443',                  username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp',    username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turns:openrelay.metered.ca:443?transport=tcp',   username: 'openrelayproject', credential: 'openrelayproject' }
  ],
  // Allow both UDP and TCP; on restrictive networks TCP-only is sometimes
  // the only path that works. iceTransportPolicy=all is the default but
  // listed explicitly so it's obvious in code reviews.
  iceTransportPolicy: 'all'
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
  _callbacks: { onSpin: null, onMemberUpdate: null, onSetComplete: null, onWorkoutStart: null, onPauseToggle: null, onTimeAdjust: null, onConnectionState: null },

  // Last observed ICE connection state, exposed via getConnectionInfo().
  connectionInfo: { state: 'idle', path: null, detail: null },

  /**
   * Hook into the underlying RTCPeerConnection of a PeerJS DataConnection
   * so we can see whether the link came up direct (host/srflx candidate
   * pair) or via relay (relay candidate). Returns nothing — fires
   * _emitConnectionState on each meaningful change.
   */
  _attachIceDiagnostics(conn) {
    const handle = () => {
      const pc = conn?.peerConnection;
      if (!pc) return;
      pc.addEventListener('iceconnectionstatechange', () => {
        const state = pc.iceConnectionState;
        this._emitConnectionState(state);
        if (state === 'connected' || state === 'completed') {
          this._classifyPath(pc).then(path => {
            this.connectionInfo.path = path;
            this._emitConnectionState(state, path);
          }).catch(() => {});
        }
      });
    };
    // PeerJS attaches peerConnection asynchronously — poll briefly.
    if (conn.peerConnection) handle();
    else {
      let tries = 0;
      const id = setInterval(() => {
        if (conn.peerConnection || ++tries > 50) { // ~5s total
          clearInterval(id);
          handle();
        }
      }, 100);
    }
  },

  /**
   * Inspect the active candidate pair to label the connection as
   * 'direct' (host/srflx) or 'relay' (TURN).
   */
  async _classifyPath(pc) {
    try {
      const stats = await pc.getStats();
      let activeLocalId = null;
      for (const r of stats.values()) {
        if (r.type === 'candidate-pair' && r.state === 'succeeded' && r.nominated) {
          activeLocalId = r.localCandidateId;
          break;
        }
      }
      if (!activeLocalId) return 'unknown';
      for (const r of stats.values()) {
        if (r.id === activeLocalId && r.type === 'local-candidate') {
          return r.candidateType === 'relay' ? 'relay' : 'direct';
        }
      }
    } catch { /* getStats unavailable */ }
    return 'unknown';
  },

  _emitConnectionState(state, path = null) {
    this.connectionInfo = {
      state,
      path: path ?? this.connectionInfo.path,
      detail: null
    };
    if (this._callbacks.onConnectionState) {
      this._callbacks.onConnectionState({ ...this.connectionInfo });
    }
  },

  onConnectionState(cb) { this._callbacks.onConnectionState = cb; },
  getConnectionInfo() { return { ...this.connectionInfo }; },

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
        this._emitConnectionState('failed');
        reject(err);
      };
      // Never hang forever if the code is wrong / the host is gone. NAT
      // traversal + free TURN can be slow, so 25s gives realistic networks
      // a fair chance before we give up.
      const timer = setTimeout(() => fail(new Error('Join timed out')), JOIN_TIMEOUT_MS);

      this._emitConnectionState('signaling');
      this.peer = new window.Peer(undefined, { config: ICE_CONFIG });
      this.peer.on('open', () => {
        this._emitConnectionState('connecting');
        const conn = this.peer.connect(ROOM_PREFIX + this.roomCode, { metadata: { name: displayName } });
        this._attachIceDiagnostics(conn);
        conn.on('open', () => {
          clearTimeout(timer);
          this.hostConnection = conn;
          this._setupMemberListeners(conn);
          // Don't fire 'connected' yet — ICE diagnostics will fire it with
          // the path label as soon as the candidate pair succeeds.
          resolve();
        });
        conn.on('error', (err) => fail(err));
      });
      this.peer.on('error', (err) => fail(err));
    });
  },

  /**
   * Diagnose what's reachable from this device. Returns:
   *  { signaling: bool, stun: bool, turn: bool, error?: string }
   * Used by the "Test Connection" button in the lobby.
   */
  async testConnection() {
    const result = { signaling: false, stun: false, turn: false };

    // Step 1: signaling — can we reach the PeerJS broker at all?
    let tempPeer = null;
    try {
      tempPeer = await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('signaling timeout')), 8000);
        const p = new window.Peer(undefined, { config: ICE_CONFIG });
        p.on('open', () => { clearTimeout(t); resolve(p); });
        p.on('error', (e) => { clearTimeout(t); reject(e); });
      });
      result.signaling = true;
    } catch (e) {
      result.error = 'Signaling server unreachable: ' + (e?.message || e);
      try { if (tempPeer) tempPeer.destroy(); } catch (_) {}
      return result;
    }

    // Step 2: gather ICE candidates from a throwaway RTCPeerConnection.
    // STUN gives us 'srflx', TURN gives us 'relay'.
    try {
      const pc = new RTCPeerConnection(ICE_CONFIG);
      pc.createDataChannel('probe');
      await pc.setLocalDescription(await pc.createOffer());
      await new Promise((resolve) => {
        const done = () => { pc.removeEventListener('icegatheringstatechange', tick); resolve(); };
        const tick = () => { if (pc.iceGatheringState === 'complete') done(); };
        pc.addEventListener('icegatheringstatechange', tick);
        pc.addEventListener('icecandidate', (e) => {
          if (!e.candidate) return done();
          const c = e.candidate.candidate || '';
          if (c.includes(' typ srflx')) result.stun = true;
          if (c.includes(' typ relay')) result.turn = true;
        });
        // Hard cap so a flaky network can't hang the probe.
        setTimeout(done, 6000);
      });
      pc.close();
    } catch (e) {
      result.error = 'ICE probe failed: ' + (e?.message || e);
    } finally {
      try { tempPeer.destroy(); } catch (_) {}
    }

    return result;
  },

  /**
   * Host: handle incoming member connection.
   */
  _handleIncomingConnection(conn) {
    if (this.members.length >= MAX_MEMBERS) {
      conn.close();
      return;
    }
    this._attachIceDiagnostics(conn);
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
