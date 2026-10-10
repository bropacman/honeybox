// Tiny PeerJS wrapper. The TV is the host; phones connect to it directly.
// Uses the free public PeerJS signaling server unless ?peer=host:port is given (local testing).

const Peer = window.Peer;
const PREFIX = 'honeybox-v1-';

export function peerOptions() {
  const params = new URLSearchParams(location.search);
  const base = {
    debug: 0,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
      ]
    }
  };
  const custom = params.get('peer');
  if (!custom) return base;
  const [host, port] = custom.split(':');
  return { ...base, host, port: Number(port) || 9000, path: '/', secure: false };
}

export function newRoomCode() {
  const letters = 'BCDFGHJKLMNPQRSTVWXZ';
  let code = '';
  for (let i = 0; i < 4; i++) code += letters[Math.floor(Math.random() * letters.length)];
  return code;
}

// Host side. onData(connId, msg), onClose(connId)
export function startHost(code, { onReady, onData, onClose, onFatal }) {
  const conns = new Map();
  let peer;
  let attempts = 0;

  function open() {
    peer = new Peer(PREFIX + code, peerOptions());
    peer.on('open', () => { attempts = 0; onReady?.(code); });
    peer.on('connection', (conn) => {
      conn.on('open', () => conns.set(conn.connectionId, conn));
      conn.on('data', (msg) => onData(conn.connectionId, msg));
      const closed = () => {
        if (conns.get(conn.connectionId) === conn) conns.delete(conn.connectionId);
        onClose(conn.connectionId);
      };
      conn.on('close', closed);
      conn.on('error', closed);
    });
    peer.on('disconnected', () => {
      // lost the signaling server; existing phone connections keep working
      setTimeout(() => { if (!peer.destroyed) peer.reconnect(); }, 1500);
    });
    peer.on('error', (err) => {
      if (err.type === 'unavailable-id') {
        // usually the old tab after a refresh still holds the id for a few seconds
        attempts++;
        peer.destroy();
        if (attempts > 8) onFatal?.('That room code is still in use. Close other Honeybox tabs and try again.');
        else setTimeout(open, 2500);
      } else if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(err.type)) {
        console.warn('peer', err.type);
      }
    });
  }
  open();

  return {
    send(connId, msg) {
      const conn = conns.get(connId);
      if (conn && conn.open) {
        try { conn.send(msg); } catch (e) { console.warn('send failed', e); }
      }
    },
    drop(connId) { conns.get(connId)?.close(); }
  };
}

// Phone side. Keeps reconnecting until stop() is called.
export function startClient(code, { onOpen, onData, onStatus }) {
  let peer = null;
  let conn = null;
  let stopped = false;
  let retryTimer = null;
  let notFound = 0;

  function retry(ms = 2000) {
    if (stopped) return;
    clearTimeout(retryTimer);
    retryTimer = setTimeout(connect, ms);
  }

  function connect() {
    if (stopped) return;
    onStatus?.('connecting');
    if (!peer || peer.destroyed) {
      peer = new Peer(peerOptions());
      peer.on('open', dial);
      peer.on('error', (err) => {
        if (err.type === 'peer-unavailable') {
          notFound++;
          onStatus?.(notFound > 3 ? 'notfound' : 'connecting');
          retry(2500);
        } else {
          console.warn('peer', err.type);
          if (peer.disconnected || peer.destroyed) { peer.destroy(); peer = null; }
          retry(2500);
        }
      });
      peer.on('disconnected', () => { if (!stopped && !peer.destroyed) peer.reconnect(); });
    } else if (peer.open) {
      dial();
    } else if (peer.disconnected) {
      peer.reconnect();
      retry(3000);
    }
  }

  function dial() {
    if (stopped) return;
    if (conn && conn.open) return;
    const c = peer.connect(PREFIX + code, { reliable: true });
    conn = c;
    const timeout = setTimeout(() => { if (!c.open) { c.close(); retry(500); } }, 8000);
    c.on('open', () => {
      clearTimeout(timeout);
      notFound = 0;
      onStatus?.('open');
      onOpen?.();
    });
    c.on('data', onData);
    c.on('close', () => {
      clearTimeout(timeout);
      if (conn === c) { conn = null; onStatus?.('connecting'); retry(1500); }
    });
    c.on('error', () => { if (conn === c) { conn = null; retry(1500); } });
  }

  const onVisible = () => {
    if (document.visibilityState === 'visible' && !(conn && conn.open)) retry(100);
  };
  document.addEventListener('visibilitychange', onVisible);
  connect();

  return {
    send(msg) {
      if (conn && conn.open) {
        try { conn.send(msg); return true; } catch (e) { return false; }
      }
      return false;
    },
    isOpen: () => Boolean(conn && conn.open),
    stop() {
      stopped = true;
      clearTimeout(retryTimer);
      document.removeEventListener('visibilitychange', onVisible);
      conn?.close();
      peer?.destroy();
    }
  };
}
