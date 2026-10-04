// MULTIPLE MOBILES transport layer for VOTE OUT IMPOSTER.
//
// Two transports, one protocol:
//  1) BroadcastChannelTransport — same browser, multiple tabs. Instant, zero setup.
//  2) WebRTCCodeTransport — real device-to-device over the network with no server:
//     host generates a one-time JOIN TICKET (sdp offer + ice, base64url), guest
//     replies with a one-time ANSWER code. Private roles are delivered only on
//     that player's DataChannel; the host is authoritative.
//
// Protocol is JSON messages { t, ... } over a string channel. Room codes are 5
// letters, for humans to say out loud.

export type RoomMessage =
  | { t: 'join'; name: string; playerId: string }
  | { t: 'joined'; ok: boolean; reason?: string; roster: { id: string; name: string }[] }
  | { t: 'roster'; roster: { id: string; name: string }[] }
  | { t: 'start-roles'; reveal: { isImposter: boolean; knowsWord: boolean; word: string | null; hint: string | null; categoryName: string } }
  | { t: 'state'; phase: string; info: Record<string, unknown> }
  | { t: 'vote'; voterId: string; targetId: string }
  | { t: 'guess'; playerId: string; guess: string }
  | { t: 'leave'; playerId: string }
  | { t: 'room-closed' };

export type TransportKind = 'broadcast' | 'webrtc';

export interface RoomTransport {
  kind: TransportKind;
  /** Send to a specific channel peer, or null = broadcast/host. */
  send(message: RoomMessage, to: string | null): void;
  onMessage: (msg: RoomMessage, from: string | null) => void;
  onPeer?: (event: 'join' | 'leave', peerId: string) => void;
  close(): void;
}

export function makeRoomCode(): string {
  const letters = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const buf = new Uint8Array(5);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => letters[b % letters.length]).join('');
}

/* --------------------------- BroadcastChannel ---------------------------- */

export function openBroadcast(code: string, peerId: string): RoomTransport {
  const bc = new BroadcastChannel('voi-room-' + code.toUpperCase());
  const t: RoomTransport = {
    kind: 'broadcast',
    send(message, to) {
      bc.postMessage({ to, from: peerId, message });
    },
    onMessage(msg, from) {
      void msg; void from;
    },
    close() {
      bc.close();
    }
  };
  bc.onmessage = (e) => {
    const { to, from, message } = e.data as { to: string | null; from: string; message: RoomMessage };
    if (to !== null && to !== peerId) return;
    t.onMessage(message, from);
  };
  return t;
}

/* ------------------------------- WebRTC ----------------------------------- */

function b64uEncode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64uDecode(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }]
};

async function waitIce(pc: RTCPeerConnection): Promise<RTCSessionDescriptionInit> {
  if (pc.iceGatheringState === 'complete') return pc.localDescription!.toJSON();
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      // mobile networks stall ICE forever — ship what we have (host candidates are usually enough on LAN)
      pc.localDescription ? resolve(pc.localDescription.toJSON()) : reject(new Error('ICE gathering timed out'));
    }, 3200);
    pc.addEventListener('icegatheringstatechange', () => {
      if (pc.iceGatheringState === 'complete') {
        window.clearTimeout(timeout);
        resolve(pc.localDescription!.toJSON());
      }
    });
  });
}

/** HOST: begin a per-guest connection; returns a base64url ticket to hand over. */
export async function hostOfferTicket(pc: RTCPeerConnection): Promise<string> {
  pc.createDataChannel('voi');
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  const desc = await waitIce(pc);
  return b64uEncode(JSON.stringify(desc));
}

/** HOST: complete a connection with the guest's answer code. */
export async function hostAcceptAnswer(pc: RTCPeerConnection, answerCode: string): Promise<void> {
  const desc = JSON.parse(b64uDecode(answerCode.trim())) as RTCSessionDescriptionInit;
  await pc.setRemoteDescription(new RTCSessionDescription(desc));
}

/** GUEST: consume a ticket, produce an answer code + the peer connection. */
export async function guestAcceptTicket(ticket: string): Promise<{ pc: RTCPeerConnection; answerCode: string }> {
  const pc = new RTCPeerConnection(RTC_CONFIG);
  const desc = JSON.parse(b64uDecode(ticket.trim())) as RTCSessionDescriptionInit;
  await pc.setRemoteDescription(new RTCSessionDescription(desc));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  const local = await waitIce(pc);
  return { pc, answerCode: b64uEncode(JSON.stringify(local)) };
}

/** Wrap a negotiated RTCDataChannel as a RoomTransport. */
export function wrapDataChannel(dc: RTCDataChannel, pc: RTCPeerConnection): RoomTransport {
  const t: RoomTransport = {
    kind: 'webrtc',
    send(message) {
      if (dc.readyState === 'open') dc.send(JSON.stringify(message));
    },
    onMessage(msg, from) {
      void msg; void from;
    },
    onPeer: undefined,
    close() {
      try { dc.close(); } catch { /* closed */ }
      try { pc.close(); } catch { /* closed */ }
    }
  };
  dc.onmessage = (e) => {
    try {
      t.onMessage(JSON.parse(e.data as string) as RoomMessage, null);
    } catch { /* malformed frame */ }
  };
  dc.onclose = () => t.onPeer?.('leave', dc.label || 'peer');
  return t;
}

export function newHostPeer(): RTCPeerConnection {
  return new RTCPeerConnection(RTC_CONFIG);
}

/** Friendly text for common connection failures. */
export function rtcErrorMessage(err: unknown): string {
  const m = err instanceof Error ? err.message : String(err);
  if (/ICE gathering timed out/i.test(m)) {
    return 'Network check timed out — try a shared Wi-Fi first, then paste the latest codes quickly.';
  }
  if (/InvalidStateError|description/i.test(m)) {
    return 'That code looks wrong or out-of-date — generate a fresh ticket on the host phone and try again.';
  }
  return 'Connection failed — phones usually connect easiest on the same Wi-Fi. ' + m;
}
