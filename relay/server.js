/**
 * Calisthenics Roulette — Group Workout Relay
 *
 * A deliberately tiny WebSocket hub. Rooms are identified by 6-char codes.
 * One host per room; members' messages are forwarded to the host; the
 * host's messages are broadcast to every member. The relay never inspects
 * workout payloads — it only understands the envelope:
 *
 *   client → server: { t: 'create', code, name }
 *                    { t: 'join',   code, name }
 *                    { t: 'msg',    data }           // app-level payload
 *   server → client: { t: 'created', code }
 *                    { t: 'joined',  code }
 *                    { t: 'error',   reason }
 *                    { t: 'member_join',  id, name } // host only
 *                    { t: 'member_leave', id }       // host only
 *                    { t: 'host_left' }              // members only
 *                    { t: 'msg', from, data }        // relayed payload
 *
 * Bandwidth per workout is a few KB, so a single shared-cpu Fly machine
 * with auto-stop handles this at effectively zero cost.
 */

const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const MAX_MEMBERS = 30;
const MAX_NAME = 30;
const MAX_MSG_BYTES = 16 * 1024; // app messages are tiny; cap hard
const ROOM_TTL_MS = 4 * 60 * 60 * 1000; // reap rooms after 4h regardless

/** code → { host: ws|null, members: Map<id, {ws, name}>, createdAt } */
const rooms = new Map();
let nextMemberId = 1;

function send(ws, obj) {
  if (ws && ws.readyState === ws.OPEN) {
    try { ws.send(JSON.stringify(obj)); } catch (_) { /* ignore */ }
  }
}

function cleanName(name) {
  if (typeof name !== 'string') return 'Guest';
  return name.slice(0, MAX_NAME).replace(/[<>&"'/]/g, '') || 'Guest';
}

function validCode(code) {
  return typeof code === 'string' && /^[A-Z2-9]{6}$/.test(code);
}

function closeRoom(code) {
  const room = rooms.get(code);
  if (!room) return;
  for (const { ws } of room.members.values()) {
    send(ws, { t: 'host_left' });
    try { ws.close(); } catch (_) {}
  }
  try { room.host?.close(); } catch (_) {}
  rooms.delete(code);
}

// Periodic reaping: dead sockets and expired rooms.
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.createdAt > ROOM_TTL_MS) { closeRoom(code); continue; }
    if (room.host && room.host.readyState > 1 /* CLOSING/CLOSED */) {
      closeRoom(code);
    }
  }
}, 60 * 1000);

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server, maxPayload: MAX_MSG_BYTES });

wss.on('connection', (ws) => {
  // Per-connection state
  let role = null;      // 'host' | 'member'
  let roomCode = null;
  let memberId = null;

  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (!msg || typeof msg.t !== 'string') return;

    switch (msg.t) {
      case 'create': {
        if (role) return;
        if (!validCode(msg.code)) { send(ws, { t: 'error', reason: 'bad_code' }); return; }
        if (rooms.has(msg.code)) { send(ws, { t: 'error', reason: 'code_taken' }); return; }
        rooms.set(msg.code, { host: ws, members: new Map(), createdAt: Date.now() });
        role = 'host';
        roomCode = msg.code;
        send(ws, { t: 'created', code: msg.code });
        break;
      }

      case 'join': {
        if (role) return;
        if (!validCode(msg.code)) { send(ws, { t: 'error', reason: 'bad_code' }); return; }
        const room = rooms.get(msg.code);
        if (!room || !room.host || room.host.readyState !== ws.OPEN) {
          send(ws, { t: 'error', reason: 'no_such_room' });
          return;
        }
        if (room.members.size >= MAX_MEMBERS) {
          send(ws, { t: 'error', reason: 'room_full' });
          return;
        }
        role = 'member';
        roomCode = msg.code;
        memberId = 'm' + (nextMemberId++);
        room.members.set(memberId, { ws, name: cleanName(msg.name) });
        send(ws, { t: 'joined', code: msg.code, id: memberId });
        send(room.host, { t: 'member_join', id: memberId, name: cleanName(msg.name) });
        break;
      }

      case 'msg': {
        if (!role || !roomCode) return;
        const room = rooms.get(roomCode);
        if (!room) return;
        if (role === 'host') {
          for (const { ws: mws } of room.members.values()) {
            send(mws, { t: 'msg', from: 'host', data: msg.data });
          }
        } else {
          send(room.host, { t: 'msg', from: memberId, data: msg.data });
        }
        break;
      }
    }
  });

  ws.on('close', () => {
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    if (!room) return;
    if (role === 'host') {
      closeRoom(roomCode);
    } else if (role === 'member') {
      room.members.delete(memberId);
      send(room.host, { t: 'member_leave', id: memberId });
    }
  });
});

// Heartbeat: terminate sockets that miss two pings.
setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { try { ws.terminate(); } catch (_) {} continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch (_) {}
  }
}, 30 * 1000);

server.listen(PORT, () => {
  console.log(`relay listening on :${PORT}`);
});
